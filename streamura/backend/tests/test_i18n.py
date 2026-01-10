"""
Tests for Internationalization (i18n) Module

Tests the following functionality:
- Translation message retrieval
- Accept-Language header parsing
- Locale middleware
- Default language fallback
"""

import pytest
from backend.i18n import (
    MESSAGES,
    SUPPORTED_LANGUAGES,
    DEFAULT_LANGUAGE,
    parse_accept_language,
    get_message,
    t,
    LocaleMiddleware,
    get_locale_from_request,
)


class TestSupportedLanguages:
    """Test supported language configuration."""

    def test_default_language_is_english(self):
        """Test that default language is English."""
        assert DEFAULT_LANGUAGE == "en"

    def test_supported_languages_include_required(self):
        """Test that all required languages are supported."""
        required = ["en", "es", "fr", "zh"]
        for lang in required:
            assert lang in SUPPORTED_LANGUAGES

    def test_messages_exist_for_all_supported_languages(self):
        """Test that translation messages exist for all supported languages."""
        for lang in SUPPORTED_LANGUAGES:
            assert lang in MESSAGES
            assert len(MESSAGES[lang]) > 0


class TestParseAcceptLanguage:
    """Test Accept-Language header parsing."""

    def test_parse_simple_language(self):
        """Test parsing simple language code."""
        assert parse_accept_language("en") == "en"
        assert parse_accept_language("es") == "es"
        assert parse_accept_language("fr") == "fr"
        assert parse_accept_language("zh") == "zh"

    def test_parse_language_with_region(self):
        """Test parsing language with region code."""
        assert parse_accept_language("en-US") == "en"
        assert parse_accept_language("es-MX") == "es"
        assert parse_accept_language("fr-FR") == "fr"
        assert parse_accept_language("zh-CN") == "zh"

    def test_parse_multiple_languages_with_quality(self):
        """Test parsing multiple languages with quality values."""
        # Prefer es (q=0.9) over fr (q=0.8)
        assert parse_accept_language("fr;q=0.8,es;q=0.9") == "es"
        # Prefer en (q=1.0 default) over es (q=0.9)
        assert parse_accept_language("en,es;q=0.9") == "en"

    def test_parse_complex_header(self):
        """Test parsing complex Accept-Language header."""
        header = "en-US,en;q=0.9,es;q=0.8,fr;q=0.7"
        assert parse_accept_language(header) == "en"

    def test_parse_unsupported_language_fallback(self):
        """Test that unsupported languages fall back to default."""
        assert parse_accept_language("de") == DEFAULT_LANGUAGE
        assert parse_accept_language("ja") == DEFAULT_LANGUAGE
        assert parse_accept_language("ko-KR") == DEFAULT_LANGUAGE

    def test_parse_empty_header(self):
        """Test parsing empty header returns default."""
        assert parse_accept_language("") == DEFAULT_LANGUAGE
        assert parse_accept_language(None) == DEFAULT_LANGUAGE

    def test_parse_whitespace_handling(self):
        """Test that whitespace is handled properly."""
        assert parse_accept_language("  en  ") == "en"
        assert parse_accept_language("en , es") == "en"

    def test_parse_invalid_quality_value(self):
        """Test handling of invalid quality values."""
        # Invalid quality should default to 0
        assert parse_accept_language("en;q=invalid,es;q=0.5") == "es"


class TestGetMessage:
    """Test message retrieval functionality."""

    def test_get_message_english(self):
        """Test getting message in English."""
        msg = get_message("auth.invalid_credentials", "en")
        assert msg == "Invalid email or password"

    def test_get_message_spanish(self):
        """Test getting message in Spanish."""
        msg = get_message("auth.invalid_credentials", "es")
        assert "Correo" in msg or "invalido" in msg

    def test_get_message_french(self):
        """Test getting message in French."""
        msg = get_message("auth.invalid_credentials", "fr")
        assert "Email" in msg or "invalide" in msg

    def test_get_message_chinese(self):
        """Test getting message in Chinese."""
        msg = get_message("auth.invalid_credentials", "zh")
        # Chinese should contain Chinese characters
        assert any("\u4e00" <= char <= "\u9fff" for char in msg)

    def test_get_message_fallback_to_english(self):
        """Test that unsupported locale falls back to English."""
        msg = get_message("auth.invalid_credentials", "de")
        assert msg == "Invalid email or password"

    def test_get_message_unknown_key_returns_key(self):
        """Test that unknown key returns the key itself."""
        msg = get_message("unknown.key", "en")
        assert msg == "unknown.key"

    def test_get_message_interpolation(self):
        """Test message interpolation with variables."""
        msg = get_message("payment.min_amount", "en", amount="$5.00")
        assert "$5.00" in msg

    def test_get_message_interpolation_spanish(self):
        """Test interpolation works for non-English languages."""
        msg = get_message("payment.min_amount", "es", amount="$5.00")
        assert "$5.00" in msg


class TestTranslationShorthand:
    """Test the t() shorthand function."""

    def test_t_function_same_as_get_message(self):
        """Test that t() returns same result as get_message()."""
        assert t("auth.invalid_credentials", "en") == get_message("auth.invalid_credentials", "en")
        assert t("user.not_found", "es") == get_message("user.not_found", "es")

    def test_t_with_interpolation(self):
        """Test t() with interpolation."""
        result = t("payment.min_amount", "en", amount="$10")
        assert "$10" in result


class TestMessageCategories:
    """Test that all message categories have translations."""

    def test_auth_messages_exist(self):
        """Test authentication messages exist in all languages."""
        auth_keys = [
            "auth.invalid_credentials",
            "auth.unauthorized",
            "auth.forbidden",
            "auth.token_expired",
        ]
        for lang in SUPPORTED_LANGUAGES:
            for key in auth_keys:
                assert key in MESSAGES[lang], f"Missing {key} in {lang}"

    def test_user_messages_exist(self):
        """Test user messages exist in all languages."""
        user_keys = [
            "user.not_found",
            "user.already_exists",
            "user.username_taken",
            "user.email_taken",
        ]
        for lang in SUPPORTED_LANGUAGES:
            for key in user_keys:
                assert key in MESSAGES[lang], f"Missing {key} in {lang}"

    def test_stream_messages_exist(self):
        """Test stream messages exist in all languages."""
        stream_keys = [
            "stream.not_found",
            "stream.ended",
            "stream.unavailable",
            "stream.not_authorized",
        ]
        for lang in SUPPORTED_LANGUAGES:
            for key in stream_keys:
                assert key in MESSAGES[lang], f"Missing {key} in {lang}"

    def test_payment_messages_exist(self):
        """Test payment messages exist in all languages."""
        payment_keys = [
            "payment.insufficient_funds",
            "payment.failed",
            "payment.invalid_amount",
        ]
        for lang in SUPPORTED_LANGUAGES:
            for key in payment_keys:
                assert key in MESSAGES[lang], f"Missing {key} in {lang}"

    def test_error_messages_exist(self):
        """Test general error messages exist in all languages."""
        error_keys = [
            "error.unknown",
            "error.server",
            "error.not_found",
            "error.validation",
        ]
        for lang in SUPPORTED_LANGUAGES:
            for key in error_keys:
                assert key in MESSAGES[lang], f"Missing {key} in {lang}"


class TestLocalizedEndpoints:
    """Test that API endpoints use i18n correctly."""

    def test_user_not_found_returns_localized_message(self, client):
        """Test that user not found returns localized message."""
        response = client.get(
            "/api/v1/users/99999",
            headers={"Accept-Language": "en"}
        )
        assert response.status_code == 404
        assert "User not found" in response.json()["detail"]

    def test_user_not_found_spanish(self, client):
        """Test user not found with Spanish locale."""
        response = client.get(
            "/api/v1/users/99999",
            headers={"Accept-Language": "es"}
        )
        assert response.status_code == 404
        detail = response.json()["detail"]
        # Spanish: "Usuario no encontrado"
        assert "Usuario" in detail or "encontrado" in detail

    def test_stream_not_found_returns_localized_message(self, client):
        """Test that stream not found returns localized message."""
        response = client.get(
            "/api/v1/streams/99999",
            headers={"Accept-Language": "en"}
        )
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_stream_not_found_french(self, client):
        """Test stream not found with French locale."""
        response = client.get(
            "/api/v1/streams/99999",
            headers={"Accept-Language": "fr"}
        )
        assert response.status_code == 404
        detail = response.json()["detail"]
        # French: "Direct non trouve"
        assert "Direct" in detail or "trouve" in detail

    def test_event_not_found_english(self, client):
        """Test event not found returns English message."""
        response = client.get(
            "/api/v1/events/99999",
            headers={"Accept-Language": "en"}
        )
        assert response.status_code == 404
        assert "Event not found" in response.json()["detail"]

    def test_event_not_found_chinese(self, client):
        """Test event not found with Chinese locale."""
        response = client.get(
            "/api/v1/events/99999",
            headers={"Accept-Language": "zh"}
        )
        assert response.status_code == 404
        detail = response.json()["detail"]
        # Should contain Chinese characters
        assert any("\u4e00" <= char <= "\u9fff" for char in detail)


class TestMessageCaching:
    """Test that message caching works correctly."""

    def test_get_message_is_cached(self):
        """Test that get_message uses LRU cache."""
        # Clear cache
        get_message.cache_clear()

        # First call
        msg1 = get_message("auth.invalid_credentials", "en")
        cache_info_1 = get_message.cache_info()

        # Second call with same args should hit cache
        msg2 = get_message("auth.invalid_credentials", "en")
        cache_info_2 = get_message.cache_info()

        assert msg1 == msg2
        assert cache_info_2.hits > cache_info_1.hits

    def test_different_locales_cached_separately(self):
        """Test that different locales are cached separately."""
        get_message.cache_clear()

        msg_en = get_message("user.not_found", "en")
        msg_es = get_message("user.not_found", "es")

        assert msg_en != msg_es
        assert get_message.cache_info().misses >= 2
