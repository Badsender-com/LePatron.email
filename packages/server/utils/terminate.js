const terminate  = ( server, options = { codedump: false, timeout: 500 }) => {
    const exit = code => {
        options.codedump ? process.abord() : process.exit(code)
    }

    return ( code, reason ) => ( err, promise ) => {
        console.log(`process exiting with code : ${code}, reason: ${reason}`)

        if(err && err instanceof Error ) {
            console.log(err.message, err.stack)
        }
        server.close(exit);
        setTimeout(exit, options.timeout).unref();
    }
}

module.exports = terminate;
