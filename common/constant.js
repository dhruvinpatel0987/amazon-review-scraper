exports.platform = {
    amazon: "amazon"
};
exports.requestEnum = {
    REQUESTED: "REQUESTED",
    IN_PROGRESS:"IN_PROGRESS",
    COMPLETED:"COMPLETED",
    FAILED:"FAILED"
};
exports.delay = (delayInms) => {
    return new Promise(resolve => setTimeout(resolve, delayInms));
};