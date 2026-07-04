// Vercel Serverless Function - webhook (postback da Pageuro)
module.exports = async (req, res) => {
    return res.status(200).json({ ok: true });
};
