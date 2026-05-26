const service = require('./calculateService');

async function calculate(req,res){
    
    try {
        const result = await service.calculate({
            module: req.body.module,
            rows: req.body.rows,
            settings: req.body.settings,
            companyId: req.user.companyId,  
        })
        return res.json(result);
    }
    catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
    }

}
module.exports = {
    calculate,
};