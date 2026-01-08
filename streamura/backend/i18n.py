"""
Internationalization (i18n) support for backend API error messages.
Provides localized error messages based on Accept-Language header.
"""

from typing import Optional
from functools import lru_cache

# Supported languages
SUPPORTED_LANGUAGES = ["en", "es", "fr", "zh"]
DEFAULT_LANGUAGE = "en"

# Translation messages
MESSAGES = {
    "en": {
        # Authentication
        "auth.invalid_credentials": "Invalid email or password",
        "auth.account_locked": "Your account has been locked",
        "auth.account_banned": "Your account has been banned",
        "auth.account_suspended": "Your account has been suspended",
        "auth.email_not_verified": "Please verify your email first",
        "auth.token_expired": "Your session has expired. Please log in again",
        "auth.token_invalid": "Invalid authentication token",
        "auth.unauthorized": "Authentication required",
        "auth.forbidden": "Access denied",
        "auth.too_many_attempts": "Too many attempts. Please try again later",

        # User
        "user.not_found": "User not found",
        "user.already_exists": "User already exists",
        "user.username_taken": "This username is already taken",
        "user.email_taken": "This email is already registered",
        "user.invalid_email": "Please enter a valid email address",
        "user.password_too_short": "Password must be at least 8 characters",
        "user.username_too_short": "Username must be at least 3 characters",

        # Stream
        "stream.not_found": "Stream not found",
        "stream.ended": "This stream has ended",
        "stream.unavailable": "Stream temporarily unavailable",
        "stream.already_live": "You are already streaming",
        "stream.not_authorized": "You are not authorized to manage this stream",
        "stream.title_required": "Stream title is required",

        # Event
        "event.not_found": "Event not found",
        "event.ended": "This event has ended",
        "event.already_joined": "You have already joined this event",

        # Payment
        "payment.insufficient_funds": "Insufficient funds",
        "payment.failed": "Payment failed",
        "payment.invalid_amount": "Invalid amount",
        "payment.min_amount": "Minimum amount is {amount}",
        "payment.max_amount": "Maximum amount is {amount}",
        "payment.payout_not_setup": "Please set up your payout account first",
        "payment.payout_failed": "Payout request failed",

        # Subscription
        "subscription.not_found": "Subscription not found",
        "subscription.already_subscribed": "You are already subscribed",
        "subscription.tier_not_found": "Subscription tier not found",
        "subscription.canceled": "Subscription has been canceled",

        # Shop
        "shop.item_not_found": "Item not found",
        "shop.already_owned": "You already own this item",
        "shop.sold_out": "This item is sold out",
        "shop.gift_failed": "Failed to send gift",
        "shop.cannot_gift_self": "You cannot gift items to yourself",

        # Community
        "community.not_found": "Community not found",
        "community.already_member": "You are already a member",
        "community.not_member": "You are not a member of this community",
        "community.name_taken": "This community name is already taken",

        # Message
        "message.not_found": "Message not found",
        "message.user_blocked": "You cannot send messages to this user",
        "message.rate_limited": "Please wait before sending another message",

        # Moderation
        "moderation.message_blocked": "Your message was blocked",
        "moderation.user_muted": "You have been muted",
        "moderation.user_banned": "You have been banned from this chat",
        "moderation.slow_mode": "Please wait before sending another message",
        "moderation.subscriber_only": "Only subscribers can chat",
        "moderation.follower_only": "Only followers can chat",

        # Upload
        "upload.file_too_large": "File is too large. Maximum size is {size}",
        "upload.invalid_type": "Invalid file type. Allowed types: {types}",
        "upload.failed": "Upload failed",

        # General
        "error.unknown": "An unknown error occurred",
        "error.server": "Server error",
        "error.network": "Network error",
        "error.not_found": "Resource not found",
        "error.validation": "Validation error",
        "error.rate_limited": "Too many requests. Please try again later",
    },
    "es": {
        # Authentication
        "auth.invalid_credentials": "Correo o contrasena invalidos",
        "auth.account_locked": "Su cuenta ha sido bloqueada",
        "auth.account_banned": "Su cuenta ha sido baneada",
        "auth.account_suspended": "Su cuenta ha sido suspendida",
        "auth.email_not_verified": "Por favor verifique su correo primero",
        "auth.token_expired": "Su sesion ha expirado. Por favor inicie sesion nuevamente",
        "auth.token_invalid": "Token de autenticacion invalido",
        "auth.unauthorized": "Autenticacion requerida",
        "auth.forbidden": "Acceso denegado",
        "auth.too_many_attempts": "Demasiados intentos. Por favor intente mas tarde",

        # User
        "user.not_found": "Usuario no encontrado",
        "user.already_exists": "El usuario ya existe",
        "user.username_taken": "Este nombre de usuario ya esta en uso",
        "user.email_taken": "Este correo ya esta registrado",
        "user.invalid_email": "Por favor ingrese un correo valido",
        "user.password_too_short": "La contrasena debe tener al menos 8 caracteres",
        "user.username_too_short": "El nombre de usuario debe tener al menos 3 caracteres",

        # Stream
        "stream.not_found": "Transmision no encontrada",
        "stream.ended": "Esta transmision ha terminado",
        "stream.unavailable": "Transmision temporalmente no disponible",
        "stream.already_live": "Ya estas transmitiendo",
        "stream.not_authorized": "No estas autorizado para administrar esta transmision",
        "stream.title_required": "El titulo de la transmision es requerido",

        # Event
        "event.not_found": "Evento no encontrado",
        "event.ended": "Este evento ha terminado",
        "event.already_joined": "Ya te has unido a este evento",

        # Payment
        "payment.insufficient_funds": "Fondos insuficientes",
        "payment.failed": "Pago fallido",
        "payment.invalid_amount": "Monto invalido",
        "payment.min_amount": "El monto minimo es {amount}",
        "payment.max_amount": "El monto maximo es {amount}",
        "payment.payout_not_setup": "Por favor configure su cuenta de pago primero",
        "payment.payout_failed": "Error en la solicitud de pago",

        # Subscription
        "subscription.not_found": "Suscripcion no encontrada",
        "subscription.already_subscribed": "Ya estas suscrito",
        "subscription.tier_not_found": "Nivel de suscripcion no encontrado",
        "subscription.canceled": "La suscripcion ha sido cancelada",

        # Shop
        "shop.item_not_found": "Articulo no encontrado",
        "shop.already_owned": "Ya posees este articulo",
        "shop.sold_out": "Este articulo esta agotado",
        "shop.gift_failed": "Error al enviar regalo",
        "shop.cannot_gift_self": "No puedes regalarte articulos a ti mismo",

        # Community
        "community.not_found": "Comunidad no encontrada",
        "community.already_member": "Ya eres miembro",
        "community.not_member": "No eres miembro de esta comunidad",
        "community.name_taken": "Este nombre de comunidad ya esta en uso",

        # Message
        "message.not_found": "Mensaje no encontrado",
        "message.user_blocked": "No puedes enviar mensajes a este usuario",
        "message.rate_limited": "Por favor espera antes de enviar otro mensaje",

        # Moderation
        "moderation.message_blocked": "Tu mensaje fue bloqueado",
        "moderation.user_muted": "Has sido silenciado",
        "moderation.user_banned": "Has sido baneado de este chat",
        "moderation.slow_mode": "Por favor espera antes de enviar otro mensaje",
        "moderation.subscriber_only": "Solo los suscriptores pueden chatear",
        "moderation.follower_only": "Solo los seguidores pueden chatear",

        # Upload
        "upload.file_too_large": "El archivo es muy grande. El tamano maximo es {size}",
        "upload.invalid_type": "Tipo de archivo invalido. Tipos permitidos: {types}",
        "upload.failed": "Error al subir archivo",

        # General
        "error.unknown": "Ocurrio un error desconocido",
        "error.server": "Error del servidor",
        "error.network": "Error de red",
        "error.not_found": "Recurso no encontrado",
        "error.validation": "Error de validacion",
        "error.rate_limited": "Demasiadas solicitudes. Por favor intente mas tarde",
    },
    "fr": {
        # Authentication
        "auth.invalid_credentials": "Email ou mot de passe invalide",
        "auth.account_locked": "Votre compte a ete verrouille",
        "auth.account_banned": "Votre compte a ete banni",
        "auth.account_suspended": "Votre compte a ete suspendu",
        "auth.email_not_verified": "Veuillez d'abord verifier votre email",
        "auth.token_expired": "Votre session a expire. Veuillez vous reconnecter",
        "auth.token_invalid": "Jeton d'authentification invalide",
        "auth.unauthorized": "Authentification requise",
        "auth.forbidden": "Acces refuse",
        "auth.too_many_attempts": "Trop de tentatives. Veuillez reessayer plus tard",

        # User
        "user.not_found": "Utilisateur non trouve",
        "user.already_exists": "L'utilisateur existe deja",
        "user.username_taken": "Ce nom d'utilisateur est deja pris",
        "user.email_taken": "Cet email est deja enregistre",
        "user.invalid_email": "Veuillez entrer une adresse email valide",
        "user.password_too_short": "Le mot de passe doit contenir au moins 8 caracteres",
        "user.username_too_short": "Le nom d'utilisateur doit contenir au moins 3 caracteres",

        # Stream
        "stream.not_found": "Direct non trouve",
        "stream.ended": "Ce direct est termine",
        "stream.unavailable": "Direct temporairement indisponible",
        "stream.already_live": "Vous etes deja en direct",
        "stream.not_authorized": "Vous n'etes pas autorise a gerer ce direct",
        "stream.title_required": "Le titre du direct est requis",

        # Event
        "event.not_found": "Evenement non trouve",
        "event.ended": "Cet evenement est termine",
        "event.already_joined": "Vous avez deja rejoint cet evenement",

        # Payment
        "payment.insufficient_funds": "Fonds insuffisants",
        "payment.failed": "Paiement echoue",
        "payment.invalid_amount": "Montant invalide",
        "payment.min_amount": "Le montant minimum est {amount}",
        "payment.max_amount": "Le montant maximum est {amount}",
        "payment.payout_not_setup": "Veuillez d'abord configurer votre compte de paiement",
        "payment.payout_failed": "Echec de la demande de paiement",

        # Subscription
        "subscription.not_found": "Abonnement non trouve",
        "subscription.already_subscribed": "Vous etes deja abonne",
        "subscription.tier_not_found": "Niveau d'abonnement non trouve",
        "subscription.canceled": "L'abonnement a ete annule",

        # Shop
        "shop.item_not_found": "Article non trouve",
        "shop.already_owned": "Vous possedez deja cet article",
        "shop.sold_out": "Cet article est epuise",
        "shop.gift_failed": "Echec de l'envoi du cadeau",
        "shop.cannot_gift_self": "Vous ne pouvez pas vous offrir d'articles",

        # Community
        "community.not_found": "Communaute non trouvee",
        "community.already_member": "Vous etes deja membre",
        "community.not_member": "Vous n'etes pas membre de cette communaute",
        "community.name_taken": "Ce nom de communaute est deja pris",

        # Message
        "message.not_found": "Message non trouve",
        "message.user_blocked": "Vous ne pouvez pas envoyer de messages a cet utilisateur",
        "message.rate_limited": "Veuillez attendre avant d'envoyer un autre message",

        # Moderation
        "moderation.message_blocked": "Votre message a ete bloque",
        "moderation.user_muted": "Vous avez ete mis en sourdine",
        "moderation.user_banned": "Vous avez ete banni de ce chat",
        "moderation.slow_mode": "Veuillez attendre avant d'envoyer un autre message",
        "moderation.subscriber_only": "Seuls les abonnes peuvent discuter",
        "moderation.follower_only": "Seuls les followers peuvent discuter",

        # Upload
        "upload.file_too_large": "Le fichier est trop volumineux. Taille maximale: {size}",
        "upload.invalid_type": "Type de fichier invalide. Types autorises: {types}",
        "upload.failed": "Echec du telechargement",

        # General
        "error.unknown": "Une erreur inconnue s'est produite",
        "error.server": "Erreur serveur",
        "error.network": "Erreur reseau",
        "error.not_found": "Ressource non trouvee",
        "error.validation": "Erreur de validation",
        "error.rate_limited": "Trop de requetes. Veuillez reessayer plus tard",
    },
    "zh": {
        # Authentication
        "auth.invalid_credentials": "邮箱或密码错误",
        "auth.account_locked": "您的账号已被锁定",
        "auth.account_banned": "您的账号已被封禁",
        "auth.account_suspended": "您的账号已被暂停",
        "auth.email_not_verified": "请先验证您的邮箱",
        "auth.token_expired": "您的会话已过期，请重新登录",
        "auth.token_invalid": "无效的认证令牌",
        "auth.unauthorized": "需要认证",
        "auth.forbidden": "访问被拒绝",
        "auth.too_many_attempts": "尝试次数过多，请稍后再试",

        # User
        "user.not_found": "用户未找到",
        "user.already_exists": "用户已存在",
        "user.username_taken": "此用户名已被使用",
        "user.email_taken": "此邮箱已被注册",
        "user.invalid_email": "请输入有效的邮箱地址",
        "user.password_too_short": "密码至少需要8个字符",
        "user.username_too_short": "用户名至少需要3个字符",

        # Stream
        "stream.not_found": "直播未找到",
        "stream.ended": "此直播已结束",
        "stream.unavailable": "直播暂时不可用",
        "stream.already_live": "您正在直播中",
        "stream.not_authorized": "您无权管理此直播",
        "stream.title_required": "直播标题为必填项",

        # Event
        "event.not_found": "活动未找到",
        "event.ended": "此活动已结束",
        "event.already_joined": "您已加入此活动",

        # Payment
        "payment.insufficient_funds": "余额不足",
        "payment.failed": "支付失败",
        "payment.invalid_amount": "金额无效",
        "payment.min_amount": "最低金额为 {amount}",
        "payment.max_amount": "最高金额为 {amount}",
        "payment.payout_not_setup": "请先设置您的提现账户",
        "payment.payout_failed": "提现请求失败",

        # Subscription
        "subscription.not_found": "订阅未找到",
        "subscription.already_subscribed": "您已订阅",
        "subscription.tier_not_found": "订阅等级未找到",
        "subscription.canceled": "订阅已取消",

        # Shop
        "shop.item_not_found": "商品未找到",
        "shop.already_owned": "您已拥有此商品",
        "shop.sold_out": "此商品已售罄",
        "shop.gift_failed": "赠送失败",
        "shop.cannot_gift_self": "您不能给自己赠送商品",

        # Community
        "community.not_found": "社区未找到",
        "community.already_member": "您已是成员",
        "community.not_member": "您不是此社区的成员",
        "community.name_taken": "此社区名称已被使用",

        # Message
        "message.not_found": "消息未找到",
        "message.user_blocked": "您无法给此用户发送消息",
        "message.rate_limited": "请等待后再发送消息",

        # Moderation
        "moderation.message_blocked": "您的消息被屏蔽",
        "moderation.user_muted": "您已被禁言",
        "moderation.user_banned": "您已被此聊天室封禁",
        "moderation.slow_mode": "请等待后再发送消息",
        "moderation.subscriber_only": "仅订阅者可发言",
        "moderation.follower_only": "仅关注者可发言",

        # Upload
        "upload.file_too_large": "文件过大，最大允许 {size}",
        "upload.invalid_type": "无效的文件类型，允许的类型：{types}",
        "upload.failed": "上传失败",

        # General
        "error.unknown": "发生未知错误",
        "error.server": "服务器错误",
        "error.network": "网络错误",
        "error.not_found": "资源未找到",
        "error.validation": "验证错误",
        "error.rate_limited": "请求过于频繁，请稍后再试",
    },
}


def parse_accept_language(accept_language: Optional[str]) -> str:
    """
    Parse Accept-Language header and return the best matching supported language.

    Examples:
        "en-US,en;q=0.9,es;q=0.8" -> "en"
        "zh-CN,zh;q=0.9" -> "zh"
        "fr-FR" -> "fr"
        None -> "en"
    """
    if not accept_language:
        return DEFAULT_LANGUAGE

    # Parse language preferences
    languages = []
    for part in accept_language.split(","):
        part = part.strip()
        if not part:
            continue

        if ";q=" in part:
            lang, q = part.split(";q=")
            try:
                quality = float(q)
            except ValueError:
                quality = 0.0
        else:
            lang = part
            quality = 1.0

        # Extract base language code (e.g., "en-US" -> "en")
        base_lang = lang.split("-")[0].lower()
        languages.append((base_lang, quality))

    # Sort by quality (descending)
    languages.sort(key=lambda x: x[1], reverse=True)

    # Find the first supported language
    for lang, _ in languages:
        if lang in SUPPORTED_LANGUAGES:
            return lang

    return DEFAULT_LANGUAGE


@lru_cache(maxsize=1000)
def get_message(key: str, locale: str = DEFAULT_LANGUAGE, **kwargs) -> str:
    """
    Get a localized message by key.

    Args:
        key: The message key (e.g., "auth.invalid_credentials")
        locale: The language code (e.g., "en", "es", "fr", "zh")
        **kwargs: Interpolation values for placeholders like {amount}

    Returns:
        The localized message string
    """
    # Ensure locale is supported
    if locale not in SUPPORTED_LANGUAGES:
        locale = DEFAULT_LANGUAGE

    # Get message from locale, fallback to English
    messages = MESSAGES.get(locale, MESSAGES[DEFAULT_LANGUAGE])
    message = messages.get(key)

    if message is None:
        # Fallback to English if key not found in current locale
        message = MESSAGES[DEFAULT_LANGUAGE].get(key, key)

    # Interpolate values
    if kwargs:
        try:
            message = message.format(**kwargs)
        except KeyError:
            pass  # If interpolation fails, return message as-is

    return message


def t(key: str, locale: str = DEFAULT_LANGUAGE, **kwargs) -> str:
    """
    Shorthand for get_message().

    Args:
        key: The message key
        locale: The language code
        **kwargs: Interpolation values

    Returns:
        The localized message string
    """
    return get_message(key, locale, **kwargs)


class LocaleMiddleware:
    """
    Middleware to extract locale from Accept-Language header and add to request state.

    Usage:
        app.add_middleware(LocaleMiddleware)

    Then in endpoints:
        locale = request.state.locale
        message = t("auth.invalid_credentials", locale)
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            headers = dict(scope.get("headers", []))
            accept_language = headers.get(b"accept-language", b"").decode("utf-8", errors="ignore")
            locale = parse_accept_language(accept_language)
            scope["state"] = scope.get("state", {})
            scope["state"]["locale"] = locale
        await self.app(scope, receive, send)


# Utility function for FastAPI dependency injection
def get_locale_from_request(request) -> str:
    """
    Get locale from request state or Accept-Language header.

    Usage:
        @app.get("/api/v1/example")
        async def example(locale: str = Depends(get_locale_from_request)):
            return {"message": t("error.not_found", locale)}
    """
    # Try to get from state (set by middleware)
    locale = getattr(request.state, "locale", None)
    if locale:
        return locale

    # Fallback to parsing header directly
    accept_language = request.headers.get("Accept-Language", "")
    return parse_accept_language(accept_language)
