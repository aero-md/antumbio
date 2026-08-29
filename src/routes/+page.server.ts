import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Le site n'a pas de page d'accueil propre : `/` renvoie sur la page utilisateur
// `home`, qui sert à la fois de vitrine et de template. Même cible partout, prod
// comprise — c'est le seul dossier de `users/` qui soit committé.
const HOME_PSEUDO = 'home';

export const load: PageServerLoad = () => {
	// 307 et pas 301 : la redirection est une décision de routage susceptible de
	// changer, un permanent se graverait dans le cache des navigateurs.
	redirect(307, `/${HOME_PSEUDO}`);
};
