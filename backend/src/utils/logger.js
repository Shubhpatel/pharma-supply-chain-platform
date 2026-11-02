const formatMessage = (level, ...args) => {
  const timestamp = new Date().toISOString();
  // Join the arguments, properly handling objects
  const message = args
    .map((arg) => (typeof arg === "object" ? (arg instanceof Error ? arg.stack : JSON.stringify(arg)) : arg))
    .join(" ");
  return `[${timestamp}] [${level}] ${message}`;
};

const logger = {
  info: (...args) => {
    console.info(formatMessage("INFO", ...args));
  },
  warn: (...args) => {
    console.warn(formatMessage("WARN", ...args));
  },
  error: (...args) => {
    console.error(formatMessage("ERROR", ...args));
  },
};

module.exports = logger;
