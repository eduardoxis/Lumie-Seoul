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
 */
function contactMerchantForProduct(productName, productBrand = '') {
    const brandStr = productBrand ? ` [${productBrand}]` : '';
    
    // Formatting the message requested by the user
    const message = `Olá!
Tenho interesse neste produto:
${productName}${brandStr}

Poderia me passar mais informações?`;

    const encodedText = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${WHATSAPP_CONFIG.phone}?text=${encodedText}`;
    
    // Open in a new tab
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Redirects user to WhatsApp with a general inquiry message.
 */
function contactMerchantGeneral() {
    const encodedText = encodeURIComponent(WHATSAPP_CONFIG.defaultMessage);
    const whatsappUrl = `https://wa.me/${WHATSAPP_CONFIG.phone}?text=${encodedText}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
}
