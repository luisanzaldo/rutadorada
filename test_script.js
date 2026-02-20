</p> <div class="flex gap-4" data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Header.astro" data-astro-source-loc="438:37"> <a class="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition-all" href="#" data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Header.astro" data-astro-source-loc="442:18"> <span class="text-sm font-bold" data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Header.astro" data-astro-source-loc="443:53">X</span> </a> <a class="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition-all" href="#" data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Header.astro" data-astro-source-loc="448:18"> <span class="text-sm font-bold" data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Header.astro" data-astro-source-loc="449:53">GH</span> </a> <a class="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition-all" href="#" data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Header.astro" data-astro-source-loc="454:18"> <span class="text-sm font-bold" data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Header.astro" data-astro-source-loc="455:53">IN</span> </a> </div> </div> </div> </div> <!-- Search Modal Overlay --> <div id="search-modal" class="fixed inset-0 z-[100] hidden" data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Header.astro" data-astro-source-loc="463:61"> <!-- Backdrop --> <div id="search-backdrop" class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Header.astro" data-astro-source-loc="468:6"></div> <!-- Modal Content --> <div class="absolute inset-x-0 top-0 pt-20 px-4 sm:px-6 flex justify-center pointer-events-none" data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Header.astro" data-astro-source-loc="474:6"> <div class="w-full max-w-2xl bg-[#0b1618] border border-[#224249] rounded-2xl shadow-2xl overflow-hidden pointer-events-auto transform transition-all" data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Header.astro" data-astro-source-loc="477:10"> <!-- Search Input --> <div class="relative p-4 border-b border-[#224249]" data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Header.astro" data-astro-source-loc="479:65"> <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute left-8 top-1/2 -translate-y-1/2 text-slate-500" data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Header.astro" data-astro-source-loc="491:18"> <circle cx="11" cy="11" r="8" data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Header.astro" data-astro-source-loc="492:22"></circle> <path d="m21 21-4.3-4.3" data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Header.astro" data-astro-source-loc="493:22"></path> </svg> <input type="text" id="search-input" placeholder="Search articles, tags, categories..." class="w-full bg-[#162a2f] text-white pl-12 pr-4 py-3 rounded-xl border border-transparent focus:border-primary/30 focus:ring-1 focus:ring-primary/20 outline-none placeholder:text-slate-500 font-medium" autocomplete="off" data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Header.astro" data-astro-source-loc="495:18"> <div class="absolute right-8 top-1/2 -translate-y-1/2 flex items-center gap-2" data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Header.astro" data-astro-source-loc="504:18"> <span class="text-[10px] font-bold text-slate-500 border border-slate-700 rounded px-1.5 py-0.5 uppercase tracking-wider" data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Header.astro" data-astro-source-loc="507:26">Esc</span> </div> </div> <!-- Results List --> <div id="search-results" class="max-h-[60vh] overflow-y-auto custom-scrollbar p-2 space-y-1" data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Header.astro" data-astro-source-loc="516:14"> <div class="text-center py-10 text-slate-500" data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Header.astro" data-astro-source-loc="517:63"> <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mb-2 opacity-20 mx-auto" data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Header.astro" data-astro-source-loc="529:22"> <circle cx="11" cy="11" r="8" data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Header.astro" data-astro-source-loc="530:26"></circle> <path d="m21 21-4.3-4.3" data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Header.astro" data-astro-source-loc="531:26"></path> </svg> <p data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Header.astro" data-astro-source-loc="533:24">Start typing to search articles...</p> </div> </div> <!-- Results Footer --> <div class="bg-[#162a2f] px-4 py-2 border-t border-[#224249] flex justify-between items-center text-[10px] text-slate-500 uppercase tracking-widest font-bold" data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Header.astro" data-astro-source-loc="540:14"> <span data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Header.astro" data-astro-source-loc="541:23">Search results list</span> <span id="results-count" data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Header.astro" data-astro-source-loc="542:42">0 articles found</span> </div> </div> </div> </div> (function(){const searchablePosts = [{"title":"Atonement: La Culpa, la Memoria y el Poder Devastador de una Mentira","description":"Un análisis de 'Expiación' (2007), la obra de Joe Wright que convierte la literatura en imagen con una elegancia sin igual, explorando cómo una mentira de infancia puede destruir vidas enteras y cómo la escritura intenta —en vano— reparar lo irreparable.","slug":"atonement","category":"Artículos","tags":["Cine británico"]},{"title":"El Laberinto del Fauno: La Fantasía como Último Refugio ante el Horror","description":"Un análisis de 'El laberinto del fauno' (2006), la obra maestra de Guillermo del Toro que entrelaza la brutalidad de la España franquista con un mundo fantástico de una belleza oscura e inquietante, preguntando hasta qué punto la imaginación puede salvarnos de la realidad.","slug":"el-laberinto-del-fauno","category":"Artículos","tags":["Cine español"]},{"title":"La Doncella: Traición, Deseo y Arte del Engaño en el Cine de Park Chan-wook","description":"Un análisis de 'La Doncella' (2016), la obra maestra de Park Chan-wook que reescribe el thriller erótico con capas de engaño, erotismo y una mirada feminista devastadora.","slug":"la-doncella","category":"Artículos","tags":["Cine coreano"]},{"title":"La La Land: El Sueño, el Amor y el Precio de Elegir","description":"Un análisis de 'La La Land' (2016), el musical de Damien Chazelle que reimagina Hollywood desde adentro: una carta de amor al arte, a los sueños imposibles y a las relaciones que nos transforman aunque no duren para siempre.","slug":"la-la-land","category":"Artículos","tags":["Cine estadounidense"]},{"title":"Orgullo y Prejuicio: La Mirada Más Honesta que el Cine le Ha Dado a Jane Austen","description":"Un análisis de 'Orgullo y Prejuicio' (2005), la adaptación de Joe Wright que devuelve a Elizabeth Bennet y Darcy al barro, al frío y a la urgencia emocional de la novela de Austen, despojando la historia de toda pátina decorativa para revelar lo que siempre fue: un retrato implacable del amor, el orgullo y las jaulas invisibles que la sociedad construye alrededor de las mujeres.","slug":"orgullo-y-prejuicio","category":"Artículos","tags":["Cine británico"]},{"title":"El Show de Truman: Vivir en Directo Dentro de la Mentira Perfecta","description":"Una crítica de 'El show de Truman' (1998), la película de Peter Weir que anticipó con asombrosa lucidez la era de la telerrealidad, las redes sociales y la vigilancia permanente, envuelta en una comedia que esconde en su interior una de las reflexiones más perturbadoras sobre la libertad y la identidad del cine moderno.","slug":"el-show-de-truman","category":"Críticas","tags":["Cine estadounidense"]},{"title":"Premios Oscar 2026: Sinners Rompe Récords y Domina las Nominaciones de la 98ª Edición","description":"La película de terror de Ryan Coogler logra 16 nominaciones, la cifra más alta en la historia de los Academy Awards, superando marcas históricas de clásicos como Titanic y La La Land. Repasamos las grandes candidaturas de una edición que promete ser memorable.","slug":"oscar-nominaciones-2026","category":"Premios","tags":["Premios Oscar"]},{"title":"Tráiler: La Odisea","description":"Tráiler oficial de La Odisea: Una épica de acción mitológica filmada alrededor del mundo.","slug":"trailer-la-odisea","category":"Tráilers","tags":["Cine estadounidense","Tráiler"]}];
const baseUrl = "/rutadorada";

    const searchBtn = document.getElementById("search-btn");
    const searchModal = document.getElementById("search-modal");
    const searchBackdrop = document.getElementById("search-backdrop");
    const searchInput = document.getElementById("search-input");
    const searchResults = document.getElementById("search-results");
    const resultsCount = document.getElementById("results-count");

    function openSearch() {
        searchModal.classList.remove("hidden");
        document.body.style.overflow = "hidden";
        setTimeout(() => searchInput.focus(), 50);
    }

    function closeSearch() {
        searchModal.classList.add("hidden");
        document.body.style.overflow = "";
        searchInput.value = "";
        renderResults([]);
    }

    function renderResults(results) {
        if (results.length === 0) {
            if (searchInput.value.trim() === "") {
                searchResults.innerHTML = `
                    <div class="text-center py-10 text-slate-500">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="40"
                        height="40"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="mb-2 opacity-20 mx-auto"
                    >
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.3-4.3"></path>
                    </svg>
                        <p>Start typing to search articles...</p>
                    </div>
                `;
            } else {
                searchResults.innerHTML = `
                    <div class="text-center py-10 text-slate-500">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="40"
                        height="40"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="mb-2 opacity-20 mx-auto"
                    >
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M16 16s-1.5-2-4-2-4 2-4 2"></path>
                        <line x1="9" x2="9.01" y1="9" y2="9"></line>
                        <line x1="15" x2="15.01" y1="9" y2="9"></line>
                    </svg>
                        <p>No results found for "${searchInput.value}"</p>
                    </div>
                `;
            }
            resultsCount.textContent = "0 articles found";
            return;
        }

        resultsCount.textContent = `${results.length} article${results.length === 1 ? "" : "s"} found`;

        searchResults.innerHTML = results
            .map(
                (post) => `
            <a href={`${baseUrl}/posts/${post.slug}`} class="flex flex-col p-4 rounded-xl hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-all group">
                <div class="flex items-center justify-between mb-1">
                    <span class="text-xs font-bold text-primary uppercase tracking-widest">${post.category}</span>
                </div>
                <h4 class="text-slate-100 font-bold group-hover:text-primary transition-colors">${post.title}</h4>
                <p class="text-sm text-slate-500 line-clamp-1 mt-1">${post.description}</p>
            </a>
        `,
            )
            .join("");
    }

    function handleSearch() {
        const query = searchInput.value.toLowerCase().trim();
        if (query === "") {
            renderResults([]);
            return;
        }

        const words = query.split(/\s+/);
        const results = searchablePosts.filter((post) => {
            const searchStr =
                `${post.title} ${post.description} ${post.category} ${post.tags.join(" ")}`.toLowerCase();
            return words.every((word) => searchStr.includes(word));
        });

        renderResults(results);
    }

    // Mobile Menu Functionality
    const mobileMenuBtn = document.getElementById("mobile-menu-btn");
    const mobileMenu = document.getElementById("mobile-menu");
    const mobileMenuBackdrop = document.getElementById("mobile-menu-backdrop");
    const mobileMenuContent = document.getElementById("mobile-menu-content");
    const bar1 = document.getElementById("menu-bar-1");
    const bar2 = document.getElementById("menu-bar-2");
    const bar3 = document.getElementById("menu-bar-3");

    let isMenuOpen = false;

    function toggleMenu() {
        console.log("toggleMenu executed! Previous state:", isMenuOpen);
        isMenuOpen = !isMenuOpen;
        console.log("New state:", isMenuOpen);

        if (isMenuOpen) {
            mobileMenu?.classList.remove("hidden");
            setTimeout(() => {
                mobileMenuBackdrop?.classList.add("opacity-100");
                mobileMenuContent?.classList.remove("translate-x-full");
                // Animate bars to X
                bar1?.classList.add("rotate-45", "translate-y-2");
                bar2?.classList.add("opacity-0", "scale-0");
                bar3?.classList.add("-rotate-45", "-translate-y-2");
            }, 10);
            document.body.style.overflow = "hidden";
        } else {
            mobileMenuBackdrop?.classList.remove("opacity-100");
            mobileMenuContent?.classList.add("translate-x-full");
            // Animate bars back
            bar1?.classList.remove("rotate-45", "translate-y-2");
            bar2?.classList.remove("opacity-0", "scale-0");
            bar3?.classList.remove("-rotate-45", "-translate-y-2");

            setTimeout(() => {
                mobileMenu?.classList.add("hidden");
            }, 300);
            document.body.style.overflow = "";
        }
    }

    if (mobileMenuBtn) {
        console.log("Attached event listener to mobileMenuBtn:", mobileMenuBtn);
        mobileMenuBtn.addEventListener("click", toggleMenu);
    } else {
        console.warn("mobileMenuBtn not found in DOM!");
    }
    if (mobileMenuBackdrop) {
        mobileMenuBackdrop.addEventListener("click", toggleMenu);
    }

    // Search Event Listeners
    const searchBtnEl = document.getElementById("search-btn");
    if (searchBtnEl) {
        searchBtnEl.addEventListener("click", openSearch);
    }
    
    const searchBackdropEl = document.getElementById("search-backdrop");
    if (searchBackdropEl) {
        searchBackdropEl.addEventListener("click", closeSearch);
    }

    const searchInputEl = document.getElementById("search-input");
    if (searchInputEl) {
        searchInputEl.addEventListener("input", handleSearch);
    }

    // Keyboard Shortcuts
    window.addEventListener("keydown", (e) => {
        if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            openSearch();
        }
        if (e.key === "Escape") {
            const sm = document.getElementById("search-modal");
            if (sm && !sm.classList.contains("hidden")) {
                closeSearch();
            }
        }
    });
})(); <script type="module" src="/src/components/Header.astro?astro&type=script&index=0&lang.ts"></script> <section class="relative min-h-[70vh] flex items-center justify-center overflow-hidden bg-[#0c0a09] text-white" data-astro-cid-bbe6dxrz data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Hero.astro" data-astro-source-loc="12:2"> <!-- Simplified Background --> <div class="absolute inset-0 z-0 overflow-hidden" data-astro-cid-bbe6dxrz data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Hero.astro" data-astro-source-loc="14:55"> <div class="absolute inset-0 bg-gradient-to-t from-[#0c0a09] to-[#1c1917] z-10" data-astro-cid-bbe6dxrz data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Hero.astro" data-astro-source-loc="15:10"></div> <!-- Subtle pattern remains --> <div class="absolute inset-0 opacity-[0.03] pointer-events-none z-20 bg-[url('https://www.transparenttextures.com/patterns/film-grain.png')]" data-astro-cid-bbe6dxrz data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Hero.astro" data-astro-source-loc="17:10"></div> </div> <!-- Theatrical Accent Lines --> <div class="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#d97706]/60 to-transparent z-20" data-astro-cid-bbe6dxrz data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Hero.astro" data-astro-source-loc="21:6"></div> <div class="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#d97706]/60 to-transparent z-20" data-astro-cid-bbe6dxrz data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Hero.astro" data-astro-source-loc="22:6"></div> <div class="relative z-30 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center" data-astro-cid-bbe6dxrz data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Hero.astro" data-astro-source-loc="24:83"> <!-- Badge --> <div class="inline-flex items-center px-6 py-2 rounded-full border border-[#d97706]/40 bg-[#d97706]/10 text-[#d97706] text-[11px] font-black uppercase tracking-[0.4em] mb-12 animate-fade-in shadow-[0_0_25px_rgba(217,119,6,0.15)]" data-astro-cid-bbe6dxrz data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Hero.astro" data-astro-source-loc="26:239"> <span class="w-1.5 h-1.5 rounded-full bg-[#d97706] mr-3 animate-pulse" data-astro-cid-bbe6dxrz data-astro-source-file="/Users/luisanzaldo/Documents/Develop/RutaDorada/src/components/Hero.astro" data-astro-source-loc="27:14"></span>
