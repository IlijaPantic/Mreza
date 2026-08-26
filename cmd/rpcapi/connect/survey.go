package connect

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"unicode/utf8"

	"connectrpc.com/connect"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"git.izbori.xyz/trsr/mreza-anketa/internal/catalog"
	dbgen "git.izbori.xyz/trsr/mreza-anketa/internal/gen/db"
	mrezav1 "git.izbori.xyz/trsr/mreza-anketa/internal/gen/mreza/v1"
	mrezav1connect "git.izbori.xyz/trsr/mreza-anketa/internal/gen/mreza/v1/mrezav1connect"
)

var (
	emailRegex      = regexp.MustCompile(`^.+@.+\..+$`)
	phoneLocalRegex = regexp.MustCompile(`^06\d{7,8}$`)
	phoneIntlRegex  = regexp.MustCompile(`^\+38\d{8,12}$`)
)

// Duzinska ogranicenja polja. Backend je autoritet — frontend validacija je
// samo UX, a rate limit i MaxBodySize hvataju grublje zloupotrebe.
const (
	maxNameLen       = 100
	maxEmailLen      = 254 // RFC 5321 gornja granica za adresu
	maxPhoneLen      = 20
	maxLargeReachURL = 500
	// Kratko ime organizacije, ne slobodan tekst — isto ogranicenje stoji i
	// kao CHECK na koloni (migracija 000005).
	maxOrganizationLen = 50
)

type SurveyHandler struct {
	pool *pgxpool.Pool
	q    *dbgen.Queries
}

func NewSurveyHandler(pool *pgxpool.Pool) *SurveyHandler {
	return &SurveyHandler{
		pool: pool,
		q:    dbgen.New(pool),
	}
}

var _ mrezav1connect.SurveyServiceHandler = (*SurveyHandler)(nil)

// Submit prima javnu prijavu za ucesce u kampanji.
//
// Nema autentikacije — zastita je slojevita izvan ovog handlera:
// rate limit po IP-u (interceptor), MaxBodySize (middleware), CHECK constraint-i
// u bazi. Ovde se radi validacija sadrzaja i normalizacija.
func (h *SurveyHandler) Submit(
	ctx context.Context,
	req *connect.Request[mrezav1.SubmitRequest],
) (*connect.Response[mrezav1.SubmitResponse], error) {
	msg := req.Msg

	if !msg.GetGdprConsent() {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("gdpr_consent must be true"))
	}

	name, err := requiredText(msg.GetName(), maxNameLen, "name")
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	surname, err := requiredText(msg.GetSurname(), maxNameLen, "surname")
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	// Email je opcion. Kad je dat, sluzi kao kljuc za detekciju duplikata,
	// pa se normalizuje na lowercase pre provere i upisa.
	var emailPtr *string
	if raw := strings.ToLower(strings.TrimSpace(msg.GetEmail())); raw != "" {
		if len(raw) > maxEmailLen || !emailRegex.MatchString(raw) {
			return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("email invalid"))
		}
		emailPtr = &raw
	}

	phone := strings.ReplaceAll(strings.TrimSpace(msg.GetPhone()), " ", "")
	if len(phone) > maxPhoneLen || (!phoneLocalRegex.MatchString(phone) && !phoneIntlRegex.MatchString(phone)) {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("phone invalid"))
	}

	rolesJSON, err := catalog.EncodeRoles(msg.GetRoles())
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	networksJSON, err := catalog.EncodeNetworks(msg.GetNetworks())
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	hasLargeReach := msg.GetHasLargeReach()
	largeReachURL, err := optionalURL(msg.LargeReachUrl, maxLargeReachURL)
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	// DB CHECK zabranjuje URL bez cekirane opcije; odbacujemo ga ovde da
	// korisnik koji je odcekirao polje ne dobije 500 zbog constraint-a.
	if !hasLargeReach {
		largeReachURL = nil
	}

	organization, err := optionalText(msg.Organization, maxOrganizationLen)
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	// Provera duplikata pre upisa daje korisniku jasnu poruku umesto
	// generickog constraint violation-a. Unique index i dalje stiti od trke.
	if emailPtr != nil {
		_, err = h.q.GetCampaignSubmissionByEmail(ctx, *emailPtr)
		if err == nil {
			return nil, connect.NewError(connect.CodeFailedPrecondition, errors.New("submission with this email already exists"))
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, connect.NewError(connect.CodeInternal, err)
		}
	}

	row, err := h.q.CreateCampaignSubmission(ctx, dbgen.CreateCampaignSubmissionParams{
		Name:          name,
		Surname:       surname,
		Email:         emailPtr,
		Phone:         phone,
		Roles:         rolesJSON,
		Networks:      networksJSON,
		HasLargeReach: hasLargeReach,
		LargeReachUrl: largeReachURL,
		Organization:  organization,
		GdprConsent:   true,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, connect.NewError(connect.CodeFailedPrecondition, errors.New("submission with this email already exists"))
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&mrezav1.SubmitResponse{
		SubmissionId: row.ID.String(),
	}), nil
}

func requiredText(raw string, maxLen int, field string) (string, error) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return "", fmt.Errorf("%s required", field)
	}
	if len(s) > maxLen {
		return "", fmt.Errorf("%s exceeds %d characters", field, maxLen)
	}
	return s, nil
}

// optionalText trimuje opciono tekstualno polje i proverava duzinu.
// Prazan string se tretira kao "nije uneto" (NULL u bazi), ne kao prazan tekst.
func optionalText(opt *string, maxLen int) (*string, error) {
	if opt == nil {
		return nil, nil
	}
	s := strings.TrimSpace(*opt)
	if s == "" {
		return nil, nil
	}
	// Broj znakova, ne bajtova — nasa slova zauzimaju po dva bajta, pa bi
	// len() neopravdano odbio kratak unos sa kvacicama.
	if utf8.RuneCountInString(s) > maxLen {
		return nil, fmt.Errorf("field exceeds %d characters", maxLen)
	}
	return &s, nil
}

// optionalURL normalizuje korisnicki unet link i garantuje http(s) shemu.
//
// Ovo je sigurnosna, ne kozmeticka provera: vrednost se u admin panelu
// renderuje kao <a href>, pa bi propusten "javascript:" ili "data:" URL bio
// XSS vektor ka adminu. Ljudi retko kucaju shemu, pa se "instagram.com/x"
// tiho prosiruje u "https://instagram.com/x" umesto da bude odbijeno.
func optionalURL(opt *string, maxLen int) (*string, error) {
	if opt == nil {
		return nil, nil
	}
	s := strings.TrimSpace(*opt)
	if s == "" {
		return nil, nil
	}
	if strings.ContainsAny(s, " \t\r\n") {
		return nil, errors.New("url must not contain whitespace")
	}
	if !strings.Contains(s, "://") {
		s = "https://" + s
	}
	if len(s) > maxLen {
		return nil, fmt.Errorf("url exceeds %d characters", maxLen)
	}

	parsed, err := url.Parse(s)
	if err != nil {
		return nil, errors.New("url invalid")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return nil, errors.New("url must use http or https")
	}
	// Host mora imati tacku — odbija "https://localhost" i slucajni tekst
	// koji je proso prefiksiranje sheme.
	if !strings.Contains(parsed.Host, ".") {
		return nil, errors.New("url host invalid")
	}

	normalized := parsed.String()
	return &normalized, nil
}
