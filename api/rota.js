module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
  const { aLng, aLat, bLng, bLat } = req.query || {};
  const nums = [aLng, aLat, bLng, bLat].map(Number);
  if (nums.some(v => !Number.isFinite(v))) return res.status(400).json({ error: 'Coordenadas inválidas' });
  const [lng1, lat1, lng2, lat2] = nums;
  const timeoutFetch = async (url, options = {}, ms = 15000) => {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    try { return await fetch(url, { ...options, signal: c.signal }); }
    finally { clearTimeout(t); }
  };
  const valhalla = async () => {
    const r = await timeoutFetch('https://valhalla1.openstreetmap.de/route', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Client-Id': 'marvel-sistemas-passar-dados' },
      body: JSON.stringify({ locations:[{lat:lat1,lon:lng1},{lat:lat2,lon:lng2}], costing:'auto', units:'kilometers' })
    }, 15000);
    if (!r.ok) throw new Error(`Valhalla HTTP ${r.status}`);
    const d = await r.json(); const km = Number(d?.trip?.summary?.length);
    if (!Number.isFinite(km) || km <= 0) throw new Error('Valhalla sem distância');
    return { km, fonte:'Valhalla' };
  };
  const osrm = async (base, fonte) => {
    const coords = `${lng1},${lat1};${lng2},${lat2}`;
    const r = await timeoutFetch(`${base}/route/v1/driving/${coords}?overview=false&alternatives=false&steps=false`, {}, 7000);
    if (!r.ok) throw new Error(`${fonte} HTTP ${r.status}`);
    const d = await r.json(); const km = Number(d?.routes?.[0]?.distance) / 1000;
    if (!Number.isFinite(km) || km <= 0) throw new Error(`${fonte} sem distância`);
    return { km, fonte };
  };
  try {
    const result = await Promise.any([
      valhalla(),
      osrm('https://router.project-osrm.org', 'OSRM principal'),
      osrm('https://routing.openstreetmap.de/routed-car', 'OSRM alternativo')
    ]);
    return res.status(200).json(result);
  } catch (e) {
    const reasons = e?.errors?.map(x => x?.message || String(x)) || [e?.message || String(e)];
    return res.status(502).json({ error:'Nenhum roteador respondeu', detalhes: reasons });
  }
};
