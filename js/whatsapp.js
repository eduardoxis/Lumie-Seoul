/*
 * Lumié Seoul - WhatsApp Integration Utility
 * Pure Vanilla ES6+
 */

const WHATSAPP_CONFIG = {
    phone: '5561993193756', // Número oficial Lumié Seoul
    defaultMessage: 'Olá! Gostaria de tirar algumas dúvidas sobre os produtos de skincare.'
};

/**
 * Redirects user to WhatsApp with a pre-filled custom message about a specific product.
 * @param {string} productName - The name of the product.
 * @param {string} productBrand - The brand of the product.
 * @param {string} productId - The product's ID, used to build a direct link to its page.
 */
function contactMerchantForProduct(productName, productBrand = '', productId = '') {
    const brandStr = productBrand ? ` [${productBrand}]` : '';
    const linkLine = productId ? `\n🔗 Link do produto: ${buildProductUrl(productId)}` : '';

    // Formatting the message requested by the user
    const message = `Olá!
Tenho interesse neste produto:
*${productName}*${brandStr}${linkLine}

Poderia me passar mais informações?`;

    const encodedText = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${WHATSAPP_CONFIG.phone}?text=${encodedText}`;
    
    // Open in a new tab
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Builds a shareable link to a product's detail page. This goes through
 * /p/:id first — a serverless function that shows a rich WhatsApp/social
 * preview card (photo, name, description) for crawlers, then redirects
 * real visitors straight into the SPA's product page.
 * @param {string} productId
 * @returns {string}
 */
function buildProductUrl(productId) {
    return `${window.location.origin}/p/${encodeURIComponent(productId)}`;
}

/**
 * Redirects user to WhatsApp with a general inquiry message.
 */
function contactMerchantGeneral() {
    const encodedText = encodeURIComponent(WHATSAPP_CONFIG.defaultMessage);
    const whatsappUrl = `https://wa.me/${WHATSAPP_CONFIG.phone}?text=${encodedText}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
}
