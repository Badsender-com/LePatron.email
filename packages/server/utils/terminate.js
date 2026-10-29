const terminate = (server, options = { codedump: false, timeout: 500 }) => {
  const exit = (code) => {
    options.codedump ? process.abord() : process.exit(code);
  };

  return (code, reason) => (err, _) => {
    console.log(`process exiting with code : ${code}, reason: ${reason}`);

    if (err && err instanceof Error) {
      console.log(err.message, err.stack);
    }
    // close calls back with an error when the server is closed already (a
    // second signal); process.exit refuses an error since Node 20.
    server.close(() => exit(code));
    setTimeout(() => exit(code), options.timeout).unref();
  };
};

module.exports = terminate;
