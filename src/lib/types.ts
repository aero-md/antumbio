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

// Effet visuel appliqué au pseudo (h1) dans le header.
// - glow : gradient blanc → couleur dominante de la PP + pulse text-shadow (default)
// - cast-shadow : texte blanc + ombre dure colorée fixe + bounce élastique top-right
export type NicknameEffect = 'glow' | 'cast-shadow';

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
	avatar?: string;      // chemin (relatif au dossier user ou absolu /u/.../...) ; png/jpg/webp/gif, animé compris
	discordUserId?: string;   // snowflake (17–20 chiffres) ; requis si `useDiscordPfp` est true
	useDiscordPfp?: boolean;  // si true et `discordUserId` valide, l'avatar est la PP Discord courante (résolue côté serveur, cache 1h) ; PP animée → webp animé
	favicon?: string;     // favicon spécifique à la page (relatif au dossier user ou URL absolue)
	titleAnimation?: TitleAnimation; // animation appliquée au <title> dans l'onglet
	background?: BackgroundConfig;
	music?: MusicConfig;
	landing?: LandingConfig;
	theme?: ThemeConfig;
	socials?: SocialLinkConfig[];
	nicknameEffect?: NicknameEffect;
	customCss?: boolean;
	customJs?: boolean;
	showViewCounter?: boolean;
}
