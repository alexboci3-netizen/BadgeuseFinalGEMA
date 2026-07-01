/* =====================================================================
   Service worker de la badgeuse — permet de fonctionner SANS internet.
   A deposer dans le MEME dossier GitHub que le fichier HTML (index.html).

   - 1re ouverture EN LIGNE : la page et ses fichiers sont mis en cache.
   - Ensuite : l'app se lance et fonctionne meme hors connexion.
   - EN LIGNE : on va d'abord chercher la derniere version (pour recevoir
     les mises a jour), et on retombe sur le cache si le reseau manque.

   Pour forcer une mise a jour du cache apres avoir modifie la badgeuse,
   changez le numero de version CACHE ci-dessous (v1 -> v2, etc.).
   ===================================================================== */
const CACHE = "badgeuse-cache-v2";

/* Fichiers de base a mettre en cache des l'installation.
   "./" = la page d'accueil (index.html) servie a la racine du dossier. */
const ESSENTIELS = ["./"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ESSENTIELS).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  /* Chargement de la PAGE (navigation) : reseau d'abord (pour avoir la
     derniere version), repli sur le cache si pas de connexion. */
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copie = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copie)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("./")))
    );
    return;
  }

  /* Requetes vers d'AUTRES domaines (API Supabase, CDN, emailjs...) : on ne
     touche PAS au cache. Indispensable pour Supabase, sinon on renverrait des
     donnees perimees au lieu d'interroger la base en ligne. */
  let sameOrigin = false;
  try { sameOrigin = new URL(req.url).origin === self.location.origin; } catch (e) {}
  if (!sameOrigin) return;

  /* Fichiers du MEME site : cache d'abord, sinon reseau (et on met en cache). */
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          const copie = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copie)).catch(() => {});
          return res;
        })
        .catch(() => cached);
    })
  );
});
