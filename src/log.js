export default fxConsole = {
    log: (...messages) => {
        if (window["FxFilterDebug"]) console.log("FxFilterJS:", ...messages);
    },
    warn: (...messages) => {
        if (window["FxFilterDebug"]) console.warn("FxFilterJS Warning:", ...messages);
    },
    error: (...messages) => {
        if (window["FxFilterDebug"]) console.error("FxFilterJS Error:", ...messages);
    },
    info: (...messages) => {
        if (window["FxFilterDebug"]) console.info("FxFilterJS Info:", ...messages);
    }
};