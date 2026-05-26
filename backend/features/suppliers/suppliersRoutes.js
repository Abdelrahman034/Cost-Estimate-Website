// features/suppliers/suppliersRoutes.js

const router             = require('express').Router();
const { requireAuth }    = require('../../middleware/auth');
const ctrl               = require('./suppliersController');

router.use(requireAuth);

// Suppliers
router.get('/',        ctrl.listSuppliers);
router.post('/',       ctrl.createSupplier);
router.patch('/:id',   ctrl.updateSupplier);
router.put('/:id',     ctrl.updateSupplier);    // frontend uses PUT
router.delete('/:id',  ctrl.deleteSupplier);

// RFQs  (must come before /:id to avoid "rfqs" matching as an id)
router.get('/rfqs',              ctrl.listRfqs);
router.post('/rfqs',             ctrl.createRfq);
router.patch('/rfqs/:id',        ctrl.updateRfq);
router.put('/rfqs/:id',          ctrl.updateRfq);   // frontend uses PUT
router.delete('/rfqs/:id',       ctrl.deleteRfq);

// Quotes nested under RFQ
router.get('/rfqs/:rfqId/quotes',                    ctrl.listQuotes);
router.put('/rfqs/:rfqId/quotes/:supplierId',        ctrl.upsertQuote);

module.exports = router;
