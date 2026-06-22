// `mobileSrc` : image statique (idéalement déjà blurrée) servie aux petits viewports
// à la place du média principal. Évite de décoder une vidéo + blur GPU sur mobile.
export type BackgroundConfig =
	| { type: 'color'; color: string }
	| { type: 'image'; src: string; mobileSrc?: string; blur?: number; dim?: number; sourceUrl?: string }
	| { type: 'video'; src: string; mobileSrc?: string; blur?: number; dim?: number; sourceUrl?: string };

export interface MusicConfig {
	src: string;
	title?: string;
	link?: string;        // si présent, le titre devient un lien cliquable vers cette URL
	thumbnail?: string;   // miniature de jaquette
	autoplay?: boolean;
	volume?: number;
	loop?: boolean;
}

export interface LandingConfig {
	enabled: boolean;
	text?: string;
	icon?: string;
}

export interface ThemeConfig {
	accent?: string;
	filter?: string;
	font?: string;
}

export type TitleAnimation = 'none' | 'blink-cursor';

// Une entrée de la rangée de liens sociaux.
// Soit `url` (lien externe), soit `copy` (texte copié au clic avec feedback "copié").
// L'icône est inférée depuis `/shared/{name}.png` ; en cas de 404, fallback sur l'icône générique.
export interface SocialLinkConfig {
	name: string;
	url?: string;
	copy?: string;
	icon?: string;   // override explicite du chemin
	label?: string;  // override du texte affiché dans le popover
}

// Le contenu visuel de la page (avatar, nom, bio, liens…) est désormais dans users/[pseudo]/index.html.
// config.json ne gère plus que l'infrastructure : bg, audio, landing, theme, compteur de vues.
export interface PageConfig {
	displayName?: string; // affiché dans le header du container (et utilisé pour le <title>)
	avatar?: string;      // chemin (relatif au dossier user ou absolu /u/.../...)
	favicon?: string;     // favicon spécifique à la page (relatif au dossier user ou URL absolue)
	titleAnimation?: TitleAnimation; // animation appliquée au <title> dans l'onglet
	background?: BackgroundConfig;
	music?: MusicConfig;
	landing?: LandingConfig;
	theme?: ThemeConfig;
	socials?: SocialLinkConfig[];
	customCss?: boolean;
	customJs?: boolean;
	showViewCounter?: boolean;
}
