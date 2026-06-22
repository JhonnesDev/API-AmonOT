import * as cheerio from 'cheerio';

const AMONOT_BASE_URL = 'https://amonot.online/index.php?page=characters&name=';

export default async function handler(req, res) {
  // Configurar CORS caso queiram consumir essa API de outros lugares no futuro
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { name, verifyComment } = req.query;

  if (!name) {
    return res.status(400).json({ error: true, status: 400, message: 'Parâmetro name é obrigatório.' });
  }

  try {
    const targetUrl = `${AMONOT_BASE_URL}${encodeURIComponent(name)}`;
    const response = await fetch(targetUrl);

    if (!response.ok) {
      return res.status(502).json({ error: true, status: 502, message: 'Falha na comunicação com o servidor oficial.' });
    }

    const htmlString = await response.text();
    const $ = cheerio.load(htmlString);

    // Verificar se a página retornou erro (personagem não encontrado)
    const errorAlert = $('.alert-danger, .error').text();
    if (errorAlert && errorAlert.includes('does not exist')) {
      return res.status(404).json({ error: true, status: 404, message: 'Personagem não encontrado.' });
    }

    const detailRows = $('.char-detail-row');

    if (detailRows.length === 0) {
      return res.status(404).json({ error: true, status: 404, message: 'Personagem não encontrado ou página vazia.' });
    }

    const characterData = {};

    detailRows.each((_, row) => {
      const labelElement = $(row).find('.char-detail-label');
      const valueElement = $(row).find('.char-detail-value');

      if (labelElement.length && valueElement.length) {
        const label = labelElement.text().trim().toLowerCase();
        
        let value = valueElement.text().trim().replace(/\s+/g, ' ');

        if (label.includes('nome') || label.includes('name')) characterData.name = value;
        else if (label.includes('sexo') || label.includes('sex')) characterData.sex = value;
        else if (label.includes('vocação') || label.includes('vocation')) characterData.vocation = value;
        else if (label.includes('level')) characterData.level = value;
        else if (label.includes('mundo') || label.includes('world')) characterData.world = value;
        else if (label.includes('resets') || label.includes('reset')) characterData.resets = value;
        else if (label.includes('saldo') || label.includes('balance')) characterData.balance = value;
        else if (label.includes('residência') || label.includes('residence')) characterData.residence = value;
        else if (label.includes('guild') || label.includes('guilda')) characterData.guild = value;
        else if (label.includes('login')) characterData.lastLogin = value;
        else if (label.includes('status')) characterData.accountStatus = value;
        else if (label.includes('comentário') || label.includes('comment')) {
          characterData.comment = valueElement.text().trim(); // Mantém o texto bruto do comentário
        }
      }
    });

    let verification = null;

    if (verifyComment) {
      const actualComment = characterData.comment || '';
      verification = {
        type: 'comment',
        expectedComment: verifyComment,
        actualComment: actualComment,
        hasComment: actualComment.length > 0,
        matches: actualComment.includes(verifyComment)
      };
    }

    return res.status(200).json({
      error: false,
      data: characterData,
      verification: verifyComment ? verification : null
    });

  } catch (error) {
    console.error('Erro na Vercel API:', error);
    return res.status(500).json({ error: true, status: 500, message: 'Erro interno ao processar os dados.' });
  }
}
