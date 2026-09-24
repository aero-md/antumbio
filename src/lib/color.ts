// Extraction de la couleur dominante d'une image (avatar/PP) pour en tirer une
// teinte d'accent propre : downscale à 48×48, binning des pixels par octets
// (5 bits/canal = 32k buckets), rejet des pixels à faible saturation / quasi-noir /
// quasi-blanc (sinon le gris/noir parasite gagne), puis bucket le plus peuplé.
// C'est ce qui donne une vraie dominante perceptuelle vs la moyenne RGB (qui mixe
// bleu + skintone → mauve/bordeaux sur la plupart des avatars).
const MIN_LUM = 0.58;
const MAX_LUM = 0.76;
const MIN_SAT = 0.5;

// La dominante brute peut sortir trop sombre (PP nocturne, ex. mesuré :
// rgb(43, 9, 21)) ou trop terne pour porter une couleur d'accent lisible sur fond
// sombre. On garde la teinte (hue) mais on ramène saturation/luminosité dans une
// fenêtre propre. Passage par HSL parce que c'est là que teinte et intensité se
// séparent proprement.
function readableTint(r: number, g: number, b: number): string {
	const rn = r / 255;
	const gn = g / 255;
	const bn = b / 255;
	const max = Math.max(rn, gn, bn);
	const min = Math.min(rn, gn, bn);
	const l = (max + min) / 2;
	const d = max - min;

	let h = 0;
	if (d !== 0) {
		if (max === rn) h = ((gn - bn) / d) % 6;
		else if (max === gn) h = (bn - rn) / d + 2;
		else h = (rn - gn) / d + 4;
		h *= 60;
		if (h < 0) h += 360;
	}
	const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

	const s2 = Math.max(MIN_SAT, Math.min(1, s));
	const l2 = Math.max(MIN_LUM, Math.min(MAX_LUM, l));

	// HSL → RGB (formule par chroma/segment de teinte).
	const c = (1 - Math.abs(2 * l2 - 1)) * s2;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = l2 - c / 2;
	const seg = Math.floor(h / 60) % 6;
	const [r1, g1, b1] = [
		[c, x, 0],
		[x, c, 0],
		[0, c, x],
		[0, x, c],
		[x, 0, c],
		[c, 0, x]
	][seg];
	const to255 = (v: number) => Math.round((v + m) * 255);
	return `rgb(${to255(r1)}, ${to255(g1)}, ${to255(b1)})`;
}

/**
 * Charge `src`, en extrait la couleur dominante « propre » (hors noir/gris/blanc)
 * et rappelle `onResult` avec un `rgb(...)` ou `null` si rien d'exploitable.
 * Retourne une fonction d'annulation (à utiliser comme cleanup de $effect).
 */
export function extractAccentColor(src: string, onResult: (color: string | null) => void): () => void {
	let cancelled = false;
	const img = new Image();
	img.crossOrigin = 'anonymous'; // requis pour pouvoir lire le canvas
	img.onload = () => {
		if (cancelled) return;
		const W = 48;
		const canvas = document.createElement('canvas');
		canvas.width = W;
		canvas.height = W;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		let data: Uint8ClampedArray;
		try {
			ctx.drawImage(img, 0, 0, W, W);
			data = ctx.getImageData(0, 0, W, W).data;
		} catch {
			onResult(null); // canvas tainted (image cross-origin sans CORS)
			return;
		}

		const buckets = new Map<number, { r: number; g: number; b: number; count: number }>();
		for (let i = 0; i < data.length; i += 4) {
			const r = data[i];
			const g = data[i + 1];
			const b = data[i + 2];
			const a = data[i + 3];
			if (a < 200) continue;
			const max = Math.max(r, g, b);
			const min = Math.min(r, g, b);
			if (max - min < 25) continue; // quasi-gris (inclut noir et blanc) : parasites
			if (max < 70) continue; // trop sombre pour porter une teinte lisible
			if (min > 230) continue; // trop clair
			const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
			const e = buckets.get(key);
			if (e) {
				e.r += r;
				e.g += g;
				e.b += b;
				e.count++;
			} else {
				buckets.set(key, { r, g, b, count: 1 });
			}
		}

		let best: { r: number; g: number; b: number; count: number } | null = null;
		for (const e of buckets.values()) {
			if (!best || e.count > best.count) best = e;
		}
		if (!best) {
			onResult(null);
			return;
		}
		const r = Math.round(best.r / best.count);
		const g = Math.round(best.g / best.count);
		const b = Math.round(best.b / best.count);
		onResult(readableTint(r, g, b));
	};
	img.onerror = () => {
		if (!cancelled) onResult(null);
	};
	img.src = src;
	return () => {
		cancelled = true;
	};
}
