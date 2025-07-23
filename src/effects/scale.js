export default {
    name: 'scale',
    callback: (element, scale2rScaleX = 1, scaleY = undefined) => {
        const c_scaleX = 1 / scale2rScaleX;
        const c_scaleY = 1 / (scaleY !== undefined ? scaleY : scale2rScaleX);
        if (c_scaleX == 0 || c_scaleY == 0 || (c_scaleX == 1 && c_scaleY == 1)) return '';
        return `
        <feImage result="gradient" xlink:href="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%'><linearGradient id='g' x1='0' y1='0' x2='1' y2='0'><stop offset='0%' stop-color='rgba(0,0,0,.5)'/><stop offset='100%' stop-color='rgba(255,255,255,.5)'/></linearGradient><rect width='100%' height='100%' fill='url(%23g)'/></svg>" />
        <feImage result="gradient2" xlink:href="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%'><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0%' stop-color='rgba(0,0,0,.5)'/><stop offset='100%' stop-color='rgba(255,255,255,.5)'/></linearGradient><rect width='100%' height='100%' fill='url(%23g)'/></svg>" />
        <feDisplacementMap in2="gradient" in="SourceGraphic" scale="${element.offsetWidth * (c_scaleX - 1)}" xChannelSelector="R" yChannelSelector="A" result="disp1"/>
        <feDisplacementMap in2="gradient2" in="disp1" scale="${element.offsetHeight * (c_scaleY - 1)}" xChannelSelector="A" yChannelSelector="R"/>
        `;
    },
    updatesOn: ['width', 'height']
}