// Package catalog je jedinstven izvor istine za dve fiksne liste u sistemu:
// uloge ucesnika (ParticipationRole) i drustvene mreze (SocialNetwork).
//
// Za svaku listu drzi tri stvari na jednom mestu:
//   - proto enum <-> kebab-case slug (slug je ono sto ide u bazu i CSV)
//   - citljivu srpsku labelu (za CSV export)
//   - kanonican redosled (izlaz je stabilan bez obzira na redosled sa klijenta)
//
// Handleri nikad ne pisu slug-ove rucno — sve ide kroz Encode/Decode funkcije
// ovde, tako da nevalidna vrednost ne moze da udje u bazu.
package catalog

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	mrezav1 "git.izbori.xyz/trsr/mreza-anketa/internal/gen/mreza/v1"
)

// Slug vrednosti za uloge. Menjanje ovih stringova je breaking change za
// postojece redove u bazi — zahteva data migraciju.
const (
	RoleContentCreator = "kreator-sadrzaja"
	RoleContentSharer  = "prenosilac-sadrzaja"
	RoleMediaOwner     = "vlasnik-medija"
	RoleWordOfMouth    = "usmena-kampanja"
)

// Slug vrednosti za drustvene mreze.
const (
	NetworkFacebook  = "facebook"
	NetworkInstagram = "instagram"
	NetworkTikTok    = "tiktok"
	NetworkYouTube   = "youtube"
	NetworkTelegram  = "telegram"
	NetworkX         = "x"
	NetworkBlog      = "blog"
)

// roleOrder definise kanonican redosled — isti u bazi, CSV-u i admin UI-ju.
var roleOrder = []mrezav1.ParticipationRole{
	mrezav1.ParticipationRole_PARTICIPATION_ROLE_CONTENT_CREATOR,
	mrezav1.ParticipationRole_PARTICIPATION_ROLE_CONTENT_SHARER,
	mrezav1.ParticipationRole_PARTICIPATION_ROLE_MEDIA_OWNER,
	mrezav1.ParticipationRole_PARTICIPATION_ROLE_WORD_OF_MOUTH,
}

var roleSlugByEnum = map[mrezav1.ParticipationRole]string{
	mrezav1.ParticipationRole_PARTICIPATION_ROLE_CONTENT_CREATOR: RoleContentCreator,
	mrezav1.ParticipationRole_PARTICIPATION_ROLE_CONTENT_SHARER:  RoleContentSharer,
	mrezav1.ParticipationRole_PARTICIPATION_ROLE_MEDIA_OWNER:     RoleMediaOwner,
	mrezav1.ParticipationRole_PARTICIPATION_ROLE_WORD_OF_MOUTH:   RoleWordOfMouth,
}

// roleLabels mora ostati uskladjeno sa src/data/roles.ts (kratke labele).
var roleLabels = map[string]string{
	RoleContentCreator: "Kreator medijskog sadržaja",
	RoleContentSharer:  "Prenosilac medijskog sadržaja",
	RoleMediaOwner:     "Vlasnik društvenih medija/stranica",
	RoleWordOfMouth:    "Učesnik u usmenoj kampanji",
}

var networkOrder = []mrezav1.SocialNetwork{
	mrezav1.SocialNetwork_SOCIAL_NETWORK_FACEBOOK,
	mrezav1.SocialNetwork_SOCIAL_NETWORK_INSTAGRAM,
	mrezav1.SocialNetwork_SOCIAL_NETWORK_TIKTOK,
	mrezav1.SocialNetwork_SOCIAL_NETWORK_YOUTUBE,
	mrezav1.SocialNetwork_SOCIAL_NETWORK_TELEGRAM,
	mrezav1.SocialNetwork_SOCIAL_NETWORK_X,
	mrezav1.SocialNetwork_SOCIAL_NETWORK_BLOG,
}

var networkSlugByEnum = map[mrezav1.SocialNetwork]string{
	mrezav1.SocialNetwork_SOCIAL_NETWORK_FACEBOOK:  NetworkFacebook,
	mrezav1.SocialNetwork_SOCIAL_NETWORK_INSTAGRAM: NetworkInstagram,
	mrezav1.SocialNetwork_SOCIAL_NETWORK_TIKTOK:    NetworkTikTok,
	mrezav1.SocialNetwork_SOCIAL_NETWORK_YOUTUBE:   NetworkYouTube,
	mrezav1.SocialNetwork_SOCIAL_NETWORK_TELEGRAM:  NetworkTelegram,
	mrezav1.SocialNetwork_SOCIAL_NETWORK_X:         NetworkX,
	mrezav1.SocialNetwork_SOCIAL_NETWORK_BLOG:      NetworkBlog,
}

// networkLabels mora ostati uskladjeno sa src/data/social-networks.ts.
var networkLabels = map[string]string{
	NetworkFacebook:  "Facebook",
	NetworkInstagram: "Instagram",
	NetworkTikTok:    "TikTok",
	NetworkYouTube:   "YouTube",
	NetworkTelegram:  "Telegram",
	NetworkX:         "X / Twitter",
	NetworkBlog:      "Blog / web stranica",
}

var (
	roleEnumBySlug    map[string]mrezav1.ParticipationRole
	roleRankBySlug    map[string]int
	networkEnumBySlug map[string]mrezav1.SocialNetwork
	networkRankBySlug map[string]int
)

func init() {
	roleEnumBySlug = make(map[string]mrezav1.ParticipationRole, len(roleSlugByEnum))
	roleRankBySlug = make(map[string]int, len(roleOrder))
	for rank, enum := range roleOrder {
		slug := roleSlugByEnum[enum]
		roleEnumBySlug[slug] = enum
		roleRankBySlug[slug] = rank
	}

	networkEnumBySlug = make(map[string]mrezav1.SocialNetwork, len(networkSlugByEnum))
	networkRankBySlug = make(map[string]int, len(networkOrder))
	for rank, enum := range networkOrder {
		slug := networkSlugByEnum[enum]
		networkEnumBySlug[slug] = enum
		networkRankBySlug[slug] = rank
	}
}

// RoleSlug vraca slug za enum. ok=false za UNSPECIFIED ili nepoznatu vrednost.
func RoleSlug(enum mrezav1.ParticipationRole) (string, bool) {
	slug, ok := roleSlugByEnum[enum]
	return slug, ok
}

// RoleEnum vraca enum za slug. ok=false za nepoznat slug.
func RoleEnum(slug string) (mrezav1.ParticipationRole, bool) {
	enum, ok := roleEnumBySlug[slug]
	return enum, ok
}

// RoleLabel vraca citljivu labelu; za nepoznat slug vraca sam slug
// (da CSV nikad ne ostane prazan zbog stale podatka).
func RoleLabel(slug string) string {
	if label, ok := roleLabels[slug]; ok {
		return label
	}
	return slug
}

// NetworkSlug vraca slug za enum. ok=false za UNSPECIFIED ili nepoznatu vrednost.
func NetworkSlug(enum mrezav1.SocialNetwork) (string, bool) {
	slug, ok := networkSlugByEnum[enum]
	return slug, ok
}

// NetworkEnum vraca enum za slug. ok=false za nepoznat slug.
func NetworkEnum(slug string) (mrezav1.SocialNetwork, bool) {
	enum, ok := networkEnumBySlug[slug]
	return enum, ok
}

// NetworkLabel vraca citljivu labelu; za nepoznat slug vraca sam slug.
func NetworkLabel(slug string) string {
	if label, ok := networkLabels[slug]; ok {
		return label
	}
	return slug
}

// EncodeRoles validira uloge sa klijenta i vraca jsonb array slug-ova.
// Duplikati se tiho uklanjaju; prazna lista je greska (bar jedna uloga je uslov).
func EncodeRoles(roles []mrezav1.ParticipationRole) ([]byte, error) {
	slugs, err := encodeSlugs(roles, RoleSlug, roleRankBySlug, "role")
	if err != nil {
		return nil, err
	}
	if len(slugs) == 0 {
		return nil, errors.New("at least one role required")
	}
	return json.Marshal(slugs)
}

// EncodeNetworks validira mreze sa klijenta i vraca jsonb array slug-ova.
// Prazna lista je dozvoljena i daje "[]" (kolona je NOT NULL).
func EncodeNetworks(networks []mrezav1.SocialNetwork) ([]byte, error) {
	slugs, err := encodeSlugs(networks, NetworkSlug, networkRankBySlug, "network")
	if err != nil {
		return nil, err
	}
	return json.Marshal(slugs)
}

// DecodeRoles cita jsonb array iz baze u proto enume, u kanonicnom redosledu.
func DecodeRoles(raw []byte) ([]mrezav1.ParticipationRole, error) {
	return decodeEnums(raw, RoleEnum, roleRankBySlug, "role")
}

// DecodeNetworks cita jsonb array iz baze u proto enume, u kanonicnom redosledu.
func DecodeNetworks(raw []byte) ([]mrezav1.SocialNetwork, error) {
	return decodeEnums(raw, NetworkEnum, networkRankBySlug, "network")
}

// RolesPretty formatira jsonb array u "Labela, Labela" za CSV kolonu.
func RolesPretty(raw []byte) (string, error) {
	return prettyLabels(raw, RoleLabel, roleRankBySlug)
}

// NetworksPretty formatira jsonb array u "Labela, Labela" za CSV kolonu.
func NetworksPretty(raw []byte) (string, error) {
	return prettyLabels(raw, NetworkLabel, networkRankBySlug)
}

// encodeSlugs je zajednicka logika za obe liste: enum -> slug, dedup, kanonican
// redosled. Nepoznata/UNSPECIFIED vrednost je greska, ne tiho preskakanje —
// klijent koji salje smece treba da dobije 400, ne polovicno sacuvan red.
func encodeSlugs[E comparable](
	values []E,
	toSlug func(E) (string, bool),
	rank map[string]int,
	kind string,
) ([]string, error) {
	seen := make(map[string]struct{}, len(values))
	out := make([]string, 0, len(values))
	for _, v := range values {
		slug, ok := toSlug(v)
		if !ok {
			return nil, fmt.Errorf("invalid %s value %v", kind, v)
		}
		if _, dup := seen[slug]; dup {
			continue
		}
		seen[slug] = struct{}{}
		out = append(out, slug)
	}
	sortByRank(out, rank)
	return out, nil
}

// decodeEnums je zajednicka logika za citanje iz baze. Nepoznat slug je greska —
// znaci da su baza i kod razisli, a tiho ignorisanje bi sakrilo problem.
func decodeEnums[E any](
	raw []byte,
	toEnum func(string) (E, bool),
	rank map[string]int,
	kind string,
) ([]E, error) {
	slugs, err := decodeSlugs(raw, rank)
	if err != nil {
		return nil, err
	}
	out := make([]E, 0, len(slugs))
	for _, slug := range slugs {
		enum, ok := toEnum(slug)
		if !ok {
			return nil, fmt.Errorf("unknown %s slug %q", kind, slug)
		}
		out = append(out, enum)
	}
	return out, nil
}

func prettyLabels(raw []byte, toLabel func(string) string, rank map[string]int) (string, error) {
	slugs, err := decodeSlugs(raw, rank)
	if err != nil {
		return "", err
	}
	labels := make([]string, 0, len(slugs))
	for _, slug := range slugs {
		labels = append(labels, toLabel(slug))
	}
	return strings.Join(labels, ", "), nil
}

func decodeSlugs(raw []byte, rank map[string]int) ([]string, error) {
	if len(raw) == 0 {
		return nil, nil
	}
	var slugs []string
	if err := json.Unmarshal(raw, &slugs); err != nil {
		return nil, fmt.Errorf("decode slug array: %w", err)
	}
	sortByRank(slugs, rank)
	return slugs, nil
}

// sortByRank sortira in-place po kanonicnom redosledu. Nepoznati slug-ovi idu
// na kraj, u leksikografskom redosledu, da izlaz ostane deterministican.
// Insertion sort jer su liste najvise 7 elemenata.
func sortByRank(slugs []string, rank map[string]int) {
	rankOf := func(s string) int {
		if r, ok := rank[s]; ok {
			return r
		}
		return len(rank)
	}
	for i := 1; i < len(slugs); i++ {
		for j := i; j > 0; j-- {
			prev, cur := slugs[j-1], slugs[j]
			rp, rc := rankOf(prev), rankOf(cur)
			if rp < rc || (rp == rc && prev <= cur) {
				break
			}
			slugs[j-1], slugs[j] = cur, prev
		}
	}
}
