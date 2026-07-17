/*
 * Lumié Seoul - WhatsApp Integration Utility
 * Pure Vanilla ES6+
 */

const WHATSAPP_CONFIG = {
    phone: '5511999998888', // Substitute with merchant number
    defaultMessage: 'Olá! Gostaria de tirar algumas dúvidas sobre os produtos de skincare.'
};

/**
 * Redirects user to WhatsApp with a pre-filled custom message about a specific product.
 * @param {string} productName - The name of the product.
 * @param {string} productBrand - The brand of the product.
 * @param {string} productPrice - The product's display price (e.g. "R$ 249,00").
 * @param {string} productId - The product's ID, used to build a direct link to its page.
 */
function contactMerchantForProduct(productName, productBrand = '', productPrice = '', productId = '') {
    const brandStr = productBrand ? ` [${productBrand}]` : '';
    const priceLine = productPrice ? `\n💰 Valor: ${productPrice}` : '';
    const linkLine = productId ? `\n🔗 Link do produto: ${buildProductUrl(productId)}` : '';

    // Formatting the message requested by the user
    const message = `Olá!
Tenho interesse neste produto:
*${productName}*${brandStr}${priceLine}${linkLine}

Poderia me passar mais informações?`;

    const encodedText = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${WHATSAPP_CONFIG.phone}?text=${encodedText}`;
    
    // Open in a new tab
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Builds a shareable, direct link to a product's detail page, preserving the
 * SPA's hash-based routing (#produto?id=...).
 * @param {string} productId
 * @returns {string}
 */
function buildProductUrl(productId) {
    return `${window.location.origin}${window.location.pathname}#produto?id=${encodeURIComponent(productId)}`;
}

/**
 * Redirects user to WhatsApp with a general inquiry message.
 */
function contactMerchantGeneral() {
    const encodedText = encodeURIComponent(WHATSAPP_CONFIG.defaultMessage);
    const whatsappUrl = `https://wa.me/${WHATSAPP_CONFIG.phone}?text=${encodedText}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
}
