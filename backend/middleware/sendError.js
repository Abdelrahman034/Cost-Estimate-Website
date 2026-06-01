// middleware/sendError.js
//
// Safe error responder for all controllers.
// - status < 500: send the actual message (it's a known/intentional error)
// - status >= 500: send a generic message (never leak DB/Prisma internals to clients)
//
// Usage in any controller catch block:
//   } catch (err) { sendError(res, err); }

module.exports = function sendError(res, err) {
  const status  = err.status || 500;
  const message = status < 500
    ? err.message
    : 'An internal error occurred.';
  res.status(status).json({ error: message });
};
