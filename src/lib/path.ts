// Résout un chemin d'asset référencé depuis config.json.
// - chemin absolu (commence par '/') ou URL complète → utilisé tel quel
//   (permet à une page de pointer vers les assets d'une autre, ex: /u/home/assets/x.mp4)
// - chemin relatif → préfixé par assetBase (= /u/[pseudo])
export function resolveAsset(assetBase: string, src: string): string {
	if (/^https?:\/\//i.test(src) || src.startsWith('/')) return src;
	return `${assetBase}/${src}`;
}
