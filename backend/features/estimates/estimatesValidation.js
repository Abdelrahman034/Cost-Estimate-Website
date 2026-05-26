// features/estimates/estimatesValidation.js

const VALID_MODULES = [
  'UNIT_SCHEDULE',
  'METAL_DUCT',
  'CW_PIPE',
  'VAV_SCHEDULE',
  'ELECTRIC_HEAT',
  'FAN_SCHEDULE',
  'LOUVERS_DAMPERS',
  'DIFFUSER_SCHEDULE',
  'SUMMARY',
];

function validateUpsertEstimate(req, res, next) {
  const { module } = req.body;

  if (!module) {
    return res.status(400).json({ error: 'module is required.' });
  }

  if (!VALID_MODULES.includes(module)) {
    return res.status(400).json({
      error: `module must be one of: ${VALID_MODULES.join(', ')}`,
    });
  }

  next();
}

module.exports = { validateUpsertEstimate, VALID_MODULES };
