const terminate = (server, options = { coredump: false, timeout: 500 }) => {
  const exit = (code) => {
    options.coredump ? process.abort() : process.exit(code);
  };

  return (code, reason) => (err, _) => {
    console.log(`process exiting with code : ${code}, reason: ${reason}`);

    if (err && err instanceof Error) {
      console.log(err.message, err.stack);
    }
    // close calls back with an error when the server never listened; a second
    // signal never sees it, the first close or the timer exits before. The
    // callback ignores it either way: process.exit refuses an error since
    // Node 20.
    server.close(() => exit(code));
    setTimeout(() => exit(code), options.timeout).unref();
  };
};

module.exports = terminate;
