package connect

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/csv"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/types/known/timestamppb"

	"git.izbori.xyz/trsr/mreza-anketa/internal/auth"
	"git.izbori.xyz/trsr/mreza-anketa/internal/catalog"
	dbgen "git.izbori.xyz/trsr/mreza-anketa/internal/gen/db"
	mrezav1 "git.izbori.xyz/trsr/mreza-anketa/internal/gen/mreza/v1"
	mrezav1connect "git.izbori.xyz/trsr/mreza-anketa/internal/gen/mreza/v1/mrezav1connect"
	"git.izbori.xyz/trsr/mreza-anketa/internal/password"
)

var adminEmailRegex = regexp.MustCompile(`^.+@.+\..+$`)

const (
	defaultPageSize = 50
	maxPageSize     = 200
	// exportPageSize je gornja granica za CSV izvoz — bez paginacije, ali sa
	// tvrdim plafonom da jedan zahtev ne moze da povuce neogranicen broj redova.
	exportPageSize = 100000
)

type AdminHandler struct {
	pool *pgxpool.Pool
	q    *dbgen.Queries
}

func NewAdminHandler(pool *pgxpool.Pool, q *dbgen.Queries) *AdminHandler {
	return &AdminHandler{pool: pool, q: q}
}

var _ mrezav1connect.AdminServiceHandler = (*AdminHandler)(nil)

func (h *AdminHandler) GetMe(
	ctx context.Context,
	_ *connect.Request[mrezav1.GetMeRequest],
) (*connect.Response[mrezav1.GetMeResponse], error) {
	admin, ok := auth.AdminFromContext(ctx)
	if !ok {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("session required"))
	}
	return connect.NewResponse(&mrezav1.GetMeResponse{
		Me: adminUserToProto(*admin),
	}), nil
}

func (h *AdminHandler) ListSubmissions(
	ctx context.Context,
	req *connect.Request[mrezav1.ListSubmissionsRequest],
) (*connect.Response[mrezav1.ListSubmissionsResponse], error) {
	pageSize := req.Msg.GetPageSize()
	if pageSize <= 0 {
		pageSize = defaultPageSize
	}
	if pageSize > maxPageSize {
		pageSize = maxPageSize
	}

	filter, err := listFilterFromRequest(req.Msg)
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	total, err := h.q.CountSubmissionsForAdmin(ctx, dbgen.CountSubmissionsForAdminParams{
		Search:     filter.search,
		Role:       filter.role,
		Network:    filter.network,
		LargeReach: filter.largeReach,
		DateFrom:   filter.dateFrom,
		DateTo:     filter.dateTo,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	cursorCreatedAt, cursorID, err := decodePageToken(req.Msg.GetPageToken())
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	// page_size + 1: visak red je signal da postoji sledeca strana.
	rows, err := h.q.ListSubmissionsForAdmin(ctx, dbgen.ListSubmissionsForAdminParams{
		Search:          filter.search,
		Role:            filter.role,
		Network:         filter.network,
		LargeReach:      filter.largeReach,
		DateFrom:        filter.dateFrom,
		DateTo:          filter.dateTo,
		CursorCreatedAt: cursorCreatedAt,
		CursorID:        cursorID,
		PageSizePlusOne: pageSize + 1,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	var nextToken string
	if int32(len(rows)) > pageSize {
		rows = rows[:pageSize]
		last := rows[len(rows)-1]
		nextToken, err = encodePageToken(last.CreatedAt, last.ID)
		if err != nil {
			return nil, connect.NewError(connect.CodeInternal, err)
		}
	}

	submissions := make([]*mrezav1.Submission, 0, len(rows))
	for _, row := range rows {
		sub, err := submissionToProto(row)
		if err != nil {
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		submissions = append(submissions, sub)
	}

	resp := &mrezav1.ListSubmissionsResponse{
		Submissions: submissions,
		TotalCount:  total,
	}
	if nextToken != "" {
		resp.NextPageToken = &nextToken
	}
	return connect.NewResponse(resp), nil
}

func (h *AdminHandler) GetSubmission(
	ctx context.Context,
	req *connect.Request[mrezav1.GetSubmissionRequest],
) (*connect.Response[mrezav1.GetSubmissionResponse], error) {
	id, err := uuid.Parse(strings.TrimSpace(req.Msg.GetId()))
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id invalid"))
	}

	row, err := h.q.GetSubmissionByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	sub, err := submissionToProto(row)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&mrezav1.GetSubmissionResponse{Submission: sub}), nil
}

func (h *AdminHandler) ExportSubmissionsCSV(
	ctx context.Context,
	req *connect.Request[mrezav1.ExportSubmissionsCSVRequest],
) (*connect.Response[mrezav1.ExportSubmissionsCSVResponse], error) {
	filter, err := exportFilterFromRequest(req.Msg)
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	rows, err := h.q.ListSubmissionsForAdmin(ctx, dbgen.ListSubmissionsForAdminParams{
		Search:          filter.search,
		Role:            filter.role,
		Network:         filter.network,
		LargeReach:      filter.largeReach,
		DateFrom:        filter.dateFrom,
		DateTo:          filter.dateTo,
		PageSizePlusOne: exportPageSize,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	csvBytes, err := buildSubmissionsCSV(rows)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	filename := fmt.Sprintf("mreza-prijave-%s.csv", time.Now().UTC().Format("2006-01-02"))
	return connect.NewResponse(&mrezav1.ExportSubmissionsCSVResponse{
		Csv:      csvBytes,
		Filename: filename,
	}), nil
}

func (h *AdminHandler) ListAdmins(
	ctx context.Context,
	_ *connect.Request[mrezav1.ListAdminsRequest],
) (*connect.Response[mrezav1.ListAdminsResponse], error) {
	rows, err := h.q.ListAdmins(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	admins := make([]*mrezav1.AdminUser, 0, len(rows))
	for _, row := range rows {
		admins = append(admins, adminUserToProto(row))
	}
	return connect.NewResponse(&mrezav1.ListAdminsResponse{Admins: admins}), nil
}

func (h *AdminHandler) InviteAdmin(
	ctx context.Context,
	req *connect.Request[mrezav1.InviteAdminRequest],
) (*connect.Response[mrezav1.InviteAdminResponse], error) {
	current, ok := auth.AdminFromContext(ctx)
	if !ok {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("session required"))
	}

	email := strings.ToLower(strings.TrimSpace(req.Msg.GetEmail()))
	if email == "" || !adminEmailRegex.MatchString(email) {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("email invalid"))
	}

	role, err := roleFromProto(req.Msg.GetRole())
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	var passwordHashPtr *string
	if pwd := req.Msg.GetInitialPassword(); pwd != "" {
		hash, herr := password.Hash(pwd)
		if herr != nil {
			if errors.Is(herr, password.ErrTooShort) {
				return nil, connect.NewError(connect.CodeInvalidArgument, herr)
			}
			return nil, connect.NewError(connect.CodeInternal, herr)
		}
		passwordHashPtr = &hash
	}

	row, err := h.q.InsertAdmin(ctx, dbgen.InsertAdminParams{
		Email: email,
		Role:  role,
		InvitedByAdminID: pgtype.UUID{
			Bytes: current.ID,
			Valid: true,
		},
		PasswordHash: passwordHashPtr,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, connect.NewError(connect.CodeFailedPrecondition, errors.New("Email je već admin"))
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&mrezav1.InviteAdminResponse{
		Admin: adminUserToProto(row),
	}), nil
}

func (h *AdminHandler) ChangeMyPassword(
	ctx context.Context,
	req *connect.Request[mrezav1.ChangeMyPasswordRequest],
) (*connect.Response[mrezav1.ChangeMyPasswordResponse], error) {
	current, ok := auth.AdminFromContext(ctx)
	if !ok {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("session required"))
	}

	newPwd := req.Msg.GetNewPassword()

	// Ko vec ima lozinku mora da dokaze da zna trenutnu — inace bi otet
	// session bio dovoljan da se nalog trajno preuzme.
	if current.PasswordHash != nil && *current.PasswordHash != "" {
		if req.Msg.CurrentPassword == nil || *req.Msg.CurrentPassword == "" {
			return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("Trenutna lozinka je obavezna"))
		}
		if err := password.Compare(*current.PasswordHash, *req.Msg.CurrentPassword); err != nil {
			if errors.Is(err, password.ErrMismatch) {
				return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("Trenutna lozinka je netačna"))
			}
			return nil, connect.NewError(connect.CodeInternal, err)
		}
	}

	hash, err := password.Hash(newPwd)
	if err != nil {
		if errors.Is(err, password.ErrTooShort) {
			return nil, connect.NewError(connect.CodeInvalidArgument, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if err := h.q.SetAdminPasswordHash(ctx, dbgen.SetAdminPasswordHashParams{
		PasswordHash: &hash,
		ID:           current.ID,
	}); err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&mrezav1.ChangeMyPasswordResponse{}), nil
}

func (h *AdminHandler) RevokeAdmin(
	ctx context.Context,
	req *connect.Request[mrezav1.RevokeAdminRequest],
) (*connect.Response[mrezav1.RevokeAdminResponse], error) {
	current, ok := auth.AdminFromContext(ctx)
	if !ok {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("session required"))
	}

	id, err := uuid.Parse(strings.TrimSpace(req.Msg.GetId()))
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id invalid"))
	}
	// Bez ovoga bi poslednji admin mogao da zakljuca sam sebe napolju.
	if id == current.ID {
		return nil, connect.NewError(connect.CodeFailedPrecondition, errors.New("Ne možete ukloniti svoj nalog"))
	}

	if _, err := h.q.RevokeAdmin(ctx, id); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&mrezav1.RevokeAdminResponse{}), nil
}

func (h *AdminHandler) ReactivateAdmin(
	ctx context.Context,
	req *connect.Request[mrezav1.ReactivateAdminRequest],
) (*connect.Response[mrezav1.ReactivateAdminResponse], error) {
	if _, ok := auth.AdminFromContext(ctx); !ok {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("session required"))
	}

	id, err := uuid.Parse(strings.TrimSpace(req.Msg.GetId()))
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("id invalid"))
	}

	row, err := h.q.ReactivateAdmin(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&mrezav1.ReactivateAdminResponse{
		Admin: adminUserToProto(row),
	}), nil
}

// listFilter drzi filtere u obliku koji sqlc ocekuje (nil = filter neaktivan).
type listFilter struct {
	search     *string
	role       *string
	network    *string
	largeReach *bool
	dateFrom   pgtype.Timestamptz
	dateTo     pgtype.Timestamptz
}

func listFilterFromRequest(msg *mrezav1.ListSubmissionsRequest) (listFilter, error) {
	return buildListFilter(
		msg.GetSearch(), msg.GetRoleFilter(), msg.GetNetworkFilter(),
		msg.GetLargeReachOnly(), msg.GetDateFrom(), msg.GetDateTo(),
	)
}

func exportFilterFromRequest(msg *mrezav1.ExportSubmissionsCSVRequest) (listFilter, error) {
	return buildListFilter(
		msg.GetSearch(), msg.GetRoleFilter(), msg.GetNetworkFilter(),
		msg.GetLargeReachOnly(), msg.GetDateFrom(), msg.GetDateTo(),
	)
}

// buildListFilter je zajednicki za listu i CSV izvoz — jedna definicija filtera
// znaci da izvoz uvek vraca tacno ono sto admin vidi na ekranu.
func buildListFilter(
	search string,
	role mrezav1.ParticipationRole,
	network mrezav1.SocialNetwork,
	largeReachOnly bool,
	dateFrom, dateTo string,
) (listFilter, error) {
	var f listFilter

	if s := strings.TrimSpace(search); s != "" {
		f.search = &s
	}

	if role != mrezav1.ParticipationRole_PARTICIPATION_ROLE_UNSPECIFIED {
		slug, ok := catalog.RoleSlug(role)
		if !ok {
			return listFilter{}, errors.New("role_filter invalid")
		}
		f.role = &slug
	}

	if network != mrezav1.SocialNetwork_SOCIAL_NETWORK_UNSPECIFIED {
		slug, ok := catalog.NetworkSlug(network)
		if !ok {
			return listFilter{}, errors.New("network_filter invalid")
		}
		f.network = &slug
	}

	// Filter se aktivira samo kad je true. false znaci "bez filtera", ne
	// "samo prijave bez veceg dometa".
	if largeReachOnly {
		v := true
		f.largeReach = &v
	}

	if s := strings.TrimSpace(dateFrom); s != "" {
		t, err := time.Parse("2006-01-02", s)
		if err != nil {
			return listFilter{}, fmt.Errorf("date_from invalid: %w", err)
		}
		f.dateFrom = pgtype.Timestamptz{Time: t.UTC(), Valid: true}
	}
	if s := strings.TrimSpace(dateTo); s != "" {
		t, err := time.Parse("2006-01-02", s)
		if err != nil {
			return listFilter{}, fmt.Errorf("date_to invalid: %w", err)
		}
		// Inkluzivno do kraja dana: sledeci dan kao ekskluzivna gornja granica.
		f.dateTo = pgtype.Timestamptz{Time: t.UTC().Add(24 * time.Hour), Valid: true}
	}

	return f, nil
}

func encodePageToken(createdAt pgtype.Timestamptz, id uuid.UUID) (string, error) {
	if !createdAt.Valid {
		return "", errors.New("invalid cursor timestamp")
	}
	raw := createdAt.Time.UTC().Format(time.RFC3339Nano) + "," + id.String()
	return base64.URLEncoding.EncodeToString([]byte(raw)), nil
}

func decodePageToken(token string) (pgtype.Timestamptz, pgtype.UUID, error) {
	if token == "" {
		return pgtype.Timestamptz{}, pgtype.UUID{}, nil
	}
	decoded, err := base64.URLEncoding.DecodeString(token)
	if err != nil {
		return pgtype.Timestamptz{}, pgtype.UUID{}, errors.New("page_token invalid")
	}
	parts := strings.SplitN(string(decoded), ",", 2)
	if len(parts) != 2 {
		return pgtype.Timestamptz{}, pgtype.UUID{}, errors.New("page_token invalid")
	}
	ts, err := time.Parse(time.RFC3339Nano, parts[0])
	if err != nil {
		return pgtype.Timestamptz{}, pgtype.UUID{}, errors.New("page_token invalid")
	}
	id, err := uuid.Parse(parts[1])
	if err != nil {
		return pgtype.Timestamptz{}, pgtype.UUID{}, errors.New("page_token invalid")
	}
	return pgtype.Timestamptz{Time: ts, Valid: true}, pgtype.UUID{Bytes: id, Valid: true}, nil
}

func submissionToProto(row dbgen.CampaignSubmission) (*mrezav1.Submission, error) {
	roles, err := catalog.DecodeRoles(row.Roles)
	if err != nil {
		return nil, err
	}
	networks, err := catalog.DecodeNetworks(row.Networks)
	if err != nil {
		return nil, err
	}

	sub := &mrezav1.Submission{
		Id:            row.ID.String(),
		Email:         derefString(row.Email),
		Name:          row.Name,
		Surname:       row.Surname,
		Phone:         row.Phone,
		Roles:         roles,
		Networks:      networks,
		HasLargeReach: row.HasLargeReach,
		LargeReachUrl: row.LargeReachUrl,
		ProfileLinks:  row.ProfileLinks,
		GdprConsent:   row.GdprConsent,
	}
	if row.CreatedAt.Valid {
		sub.CreatedAt = timestamppb.New(row.CreatedAt.Time)
	}
	return sub, nil
}

func derefString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func adminUserToProto(row dbgen.AdminUser) *mrezav1.AdminUser {
	out := &mrezav1.AdminUser{
		Id:          row.ID.String(),
		Email:       row.Email,
		Role:        roleToProto(row.Role),
		Active:      row.Active,
		HasPassword: row.PasswordHash != nil && *row.PasswordHash != "",
	}
	if row.CreatedAt.Valid {
		out.CreatedAt = timestamppb.New(row.CreatedAt.Time)
	}
	if row.LastLoginAt.Valid {
		out.LastLoginAt = timestamppb.New(row.LastLoginAt.Time)
	}
	if row.InvitedByAdminID.Valid {
		s := uuid.UUID(row.InvitedByAdminID.Bytes).String()
		out.InvitedByAdminId = &s
	}
	return out
}

func roleToProto(role string) mrezav1.AdminRole {
	switch role {
	case "admin":
		return mrezav1.AdminRole_ADMIN_ROLE_ADMIN
	case "viewer":
		return mrezav1.AdminRole_ADMIN_ROLE_VIEWER
	default:
		return mrezav1.AdminRole_ADMIN_ROLE_UNSPECIFIED
	}
}

func roleFromProto(role mrezav1.AdminRole) (string, error) {
	switch role {
	case mrezav1.AdminRole_ADMIN_ROLE_ADMIN:
		return "admin", nil
	case mrezav1.AdminRole_ADMIN_ROLE_VIEWER:
		return "viewer", nil
	default:
		return "", errors.New("role invalid")
	}
}

// buildSubmissionsCSV pravi UTF-8 CSV sa istim kolonama kao admin tabela.
func buildSubmissionsCSV(rows []dbgen.CampaignSubmission) ([]byte, error) {
	var buf bytes.Buffer
	// BOM: bez njega Excel na Windowsu prikazuje nasa slova kao smece.
	buf.WriteString("\ufeff")
	w := csv.NewWriter(&buf)

	if err := w.Write([]string{
		"id", "datum", "ime", "prezime", "email", "telefon",
		"uloge", "drustvene_mreze", "veci_domet", "link_veceg_dometa",
		"linkovi_profila", "saglasnost",
	}); err != nil {
		return nil, err
	}

	for _, row := range rows {
		rolesPretty, err := catalog.RolesPretty(row.Roles)
		if err != nil {
			return nil, err
		}
		networksPretty, err := catalog.NetworksPretty(row.Networks)
		if err != nil {
			return nil, err
		}
		createdAt := ""
		if row.CreatedAt.Valid {
			createdAt = row.CreatedAt.Time.UTC().Format(time.RFC3339)
		}
		record := []string{
			row.ID.String(),
			createdAt,
			row.Name,
			row.Surname,
			derefString(row.Email),
			row.Phone,
			rolesPretty,
			networksPretty,
			boolLabel(row.HasLargeReach),
			derefString(row.LargeReachUrl),
			derefString(row.ProfileLinks),
			boolLabel(row.GdprConsent),
		}
		if err := w.Write(record); err != nil {
			return nil, err
		}
	}

	w.Flush()
	if err := w.Error(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func boolLabel(b bool) string {
	if b {
		return "da"
	}
	return "ne"
}
