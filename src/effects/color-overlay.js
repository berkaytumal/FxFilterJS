export default {
    name: "color-overlay",
    callback: (element, color, opacity = 1) => {
        return `
            <feFlood flood-color="${color}" flood-opacity="${opacity}" result="colorOverlay"/>
            <feComposite in="colorOverlay" in2="SourceGraphic" operator="over"/>
        `;
    }
}
