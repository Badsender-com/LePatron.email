const middleware = {}

middleware['authentication-check'] = require('../middleware/authentication-check.js')
middleware['authentication-check'] = middleware['authentication-check'].default || middleware['authentication-check']

export default middleware
