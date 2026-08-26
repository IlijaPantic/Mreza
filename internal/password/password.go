// Package password — bcrypt hashing i compare za admin lozinke.
package password

import (
	"errors"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"
)

// MinLength — minimalna duzina plaintext lozinke (chars, ne byte-ova).
const MinLength = 8

// BcryptCost — bcrypt cost faktor. 12 = ~250ms na modernom CPU; balans security vs latency.
const BcryptCost = 12

var (
	ErrTooShort = errors.New("lozinka mora imati bar 8 karaktera")
	ErrMismatch = errors.New("netacna lozinka")
)

// Hash uzima plaintext i vraca bcrypt hash (kao string).
// Validira da je plaintext dovoljno dugacak.
func Hash(plaintext string) (string, error) {
	if utf8.RuneCountInString(plaintext) < MinLength {
		return "", ErrTooShort
	}
	h, err := bcrypt.GenerateFromPassword([]byte(plaintext), BcryptCost)
	if err != nil {
		return "", err
	}
	return string(h), nil
}

// Compare proverava da li plaintext odgovara hash-u.
// Vraca ErrMismatch ako ne odgovara.
func Compare(hash, plaintext string) error {
	if hash == "" {
		return ErrMismatch
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(plaintext)); err != nil {
		if errors.Is(err, bcrypt.ErrMismatchedHashAndPassword) {
			return ErrMismatch
		}
		return err
	}
	return nil
}
