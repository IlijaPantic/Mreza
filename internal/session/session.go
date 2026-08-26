package session

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/sessions"
)

const SessionCookieName = "mreza_session"

const adminIDKey = "admin_id"

func NewStore(secret []byte, isProduction bool) *sessions.CookieStore {
	store := sessions.NewCookieStore(secret)
	store.Options = &sessions.Options{
		Path:     "/",
		MaxAge:   7 * 24 * 3600,
		HttpOnly: true,
		Secure:   isProduction,
		SameSite: http.SameSiteLaxMode,
	}
	return store
}

func SetAdminID(w http.ResponseWriter, r *http.Request, store *sessions.CookieStore, adminID uuid.UUID) error {
	sess, err := store.Get(r, SessionCookieName)
	if err != nil {
		return err
	}
	sess.Values[adminIDKey] = adminID.String()
	return sess.Save(r, w)
}

func GetAdminID(r *http.Request, store *sessions.CookieStore) (uuid.UUID, bool) {
	sess, err := store.Get(r, SessionCookieName)
	if err != nil {
		return uuid.UUID{}, false
	}
	raw, ok := sess.Values[adminIDKey].(string)
	if !ok || raw == "" {
		return uuid.UUID{}, false
	}
	id, err := uuid.Parse(raw)
	if err != nil {
		return uuid.UUID{}, false
	}
	return id, true
}

func Clear(w http.ResponseWriter, r *http.Request, store *sessions.CookieStore) error {
	sess, err := store.Get(r, SessionCookieName)
	if err != nil {
		return err
	}
	sess.Options.MaxAge = -1
	sess.Values = make(map[interface{}]interface{})
	return sess.Save(r, w)
}
