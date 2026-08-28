const songsList = document.getElementById("songsList");
const favoritesList = document.getElementById("favoritesList");

const modal = document.getElementById("songModal");
const songTitle = document.getElementById("songTitle");
const songText = document.getElementById("songText");
const closeBtn = document.getElementById("closeBtn");
const showMoreBtn = document.getElementById("showMoreBtn");

const searchInput = document.getElementById("searchInput");
const searchSuggestions = document.getElementById("searchSuggestions");
const favoritesHeader = document.getElementById("favoritesHeader");
const songsHeader = document.getElementById("songsHeader");
const themeToggle = document.getElementById("themeToggle");
const modalSearchInput = document.getElementById("modalSearchInput");
const modalSearchSuggestions = document.getElementById("modalSearchSuggestions");

function applyTheme(theme){

    const isDark = theme === "dark";

    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    themeToggle.setAttribute("aria-pressed", String(isDark));
    themeToggle.setAttribute(
        "aria-label",
        isDark ? "Activează tema luminoasă" : "Activează tema întunecată"
    );
}

applyTheme(localStorage.getItem("theme") || "light");

themeToggle.addEventListener("click", () => {

    const nextTheme = document.documentElement.dataset.theme === "dark"
        ? "light"
        : "dark";

    localStorage.setItem("theme", nextTheme);
    applyTheme(nextTheme);

});

let songs = {};
let showAllSongs = false;

let favorites =
    JSON.parse(localStorage.getItem("favorites")) || [];

fetch("Cantarile/cantarile.json")
    .then(response => response.json())
    .then(data => {

        songs = data;

        renderSongs(data);

        renderFavorites();

    });

function renderSongs(data){

    songsList.innerHTML = "";

    const songIds = Object.keys(data);
    const visibleSongIds = showAllSongs
        ? songIds
        : songIds.slice(0, 10);

    visibleSongIds.forEach(id => {

        const card = createSongCard(id);

        songsList.appendChild(card);

    });

    showMoreBtn.style.display = songIds.length > 10 ? "block" : "none";
    showMoreBtn.textContent = showAllSongs
        ? "Arată mai puține"
        : "Vezi mai multe";

}

function getSongTitle(id){

    const firstVerse = cleanSongText(songs[id])
        .split(/\r?\n/)
        .map(line => line.trim())
        .find(line => line.length > 0);

    if(!firstVerse){
        return `Cântarea ${id}!`;
    }

    return `${firstVerse.replace(/[.,!\-–—"':]+$/, "").trim()}!`;
}

function cleanSongText(text){

    return String(text || "")
        .replace(/\/{1,2}\s*:\s*\/{0,2}|:\s*\/{1,2}/g, "");
}

function createSongCard(id){

    const card = document.createElement("div");

    card.classList.add("song-card");

    const isFavorite =
        favorites.includes(id);

    card.innerHTML = `

        <div class="song-number">
            ${id}
        </div>

        <div class="song-title">
            ${getSongTitle(id)}
        </div>

        <button class="star-btn">
            ${isFavorite ? "★" : "☆"}
        </button>

    `;

    card.addEventListener("click", () => {

        openSong(id);

    });

    const star =
        card.querySelector(".star-btn");

    star.addEventListener("click", (e) => {

        e.stopPropagation();

        toggleFavorite(id);

    });

    return card;
}

function getMatchingSongIds(value){

    return Object.keys(songs)
        .map(id => ({ id, score: getSongMatchScore(id, value) }))
        .filter(song => song.score > 0)
        .sort((first, second) =>
            second.score - first.score || Number(first.id) - Number(second.id)
        )
        .map(song => song.id);
}

function normalizeSearchText(text){

    return String(text || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function getEditDistance(firstText, secondText){

    const previousRow = Array.from(
        { length: secondText.length + 1 },
        (_, index) => index
    );

    for(let firstIndex = 1; firstIndex <= firstText.length; firstIndex++){

        let previousDiagonal = previousRow[0];
        previousRow[0] = firstIndex;

        for(let secondIndex = 1; secondIndex <= secondText.length; secondIndex++){

            const currentValue = previousRow[secondIndex];
            const replacementCost = firstText[firstIndex - 1] === secondText[secondIndex - 1]
                ? 0
                : 1;

            previousRow[secondIndex] = Math.min(
                previousRow[secondIndex] + 1,
                previousRow[secondIndex - 1] + 1,
                previousDiagonal + replacementCost
            );

            previousDiagonal = currentValue;
        }
    }

    return previousRow[secondText.length];
}

function getSongMatchScore(id, value){

    const query = normalizeSearchText(value);
    const title = normalizeSearchText(getSongTitle(id));

    if(!query){
        return 1;
    }

    if(normalizeSearchText(id) === query){
        return 2000;
    }

    if(/^\d+$/.test(query) && normalizeSearchText(id).startsWith(query)){
        return 1200;
    }

    if(title.startsWith(query)){
        return 1500;
    }

    const titleWords = title.split(/\s+/);
    const queryWords = query.split(/\s+/);
    const matchingWordScores = queryWords.map((queryWord, index) => {

        const titleWord = titleWords[index] || "";

        if(titleWord.startsWith(queryWord)){
            return 900;
        }

        if(queryWord.length > 2 && getEditDistance(titleWord, queryWord) <= 1){
            return 700;
        }

        return 0;
    });

    if(matchingWordScores.every(score => score > 0)){
        return Math.min(...matchingWordScores) + (title.startsWith(queryWords[0]) ? 150 : 0);
    }

    return 0;
}

function renderSearchSuggestions(value){

    const matchingIds = getMatchingSongIds(value).slice(0, 8);

    searchSuggestions.innerHTML = "";

    if(!matchingIds.length){

        searchSuggestions.innerHTML =
            `<div class="search-empty">Nu am găsit nicio cântare.</div>`;

    }else{

        matchingIds.forEach(id => {

            const suggestion = document.createElement("div");

            suggestion.className = "search-suggestion";
            suggestion.setAttribute("role", "option");
            suggestion.tabIndex = 0;
            suggestion.innerHTML = `
                <span class="search-suggestion-number">${id}</span>
                <span class="search-suggestion-title">${getSongTitle(id)}</span>
                <button class="suggestion-star" type="button" aria-label="Adaugă la favorite">
                    ${favorites.includes(id) ? "★" : "☆"}
                </button>
            `;

            suggestion.addEventListener("click", event => {

                if(event.target.closest(".suggestion-star")){
                    return;
                }

                openSong(id);
                searchSuggestions.classList.remove("is-visible");

            });

            suggestion.querySelector(".suggestion-star").addEventListener("click", event => {

                event.stopPropagation();
                toggleFavorite(id);

            });

            searchSuggestions.appendChild(suggestion);
        });
    }

    searchSuggestions.classList.add("is-visible");
}

function renderModalSearchSuggestions(value){

    const matchingIds = getMatchingSongIds(value).slice(0, 8);

    modalSearchSuggestions.innerHTML = "";

    if(!matchingIds.length){

        modalSearchSuggestions.innerHTML =
            `<div class="search-empty">Nu am găsit nicio cântare.</div>`;

    }else{

        matchingIds.forEach(id => {

            const suggestion = document.createElement("div");

            suggestion.className = "search-suggestion";
            suggestion.setAttribute("role", "option");
            suggestion.tabIndex = 0;
            suggestion.innerHTML = `
                <span class="search-suggestion-number">${id}</span>
                <span class="search-suggestion-title">${getSongTitle(id)}</span>
                <button class="suggestion-star" type="button" aria-label="Adaugă la favorite">
                    ${favorites.includes(id) ? "★" : "☆"}
                </button>
            `;

            suggestion.addEventListener("click", event => {

                if(event.target.closest(".suggestion-star")){
                    return;
                }

                openSong(id);
                modalSearchInput.value = "";
                modalSearchSuggestions.classList.remove("is-visible");

            });

            suggestion.querySelector(".suggestion-star").addEventListener("click", event => {

                event.stopPropagation();
                toggleFavorite(id);

            });

            modalSearchSuggestions.appendChild(suggestion);
        });
    }

    modalSearchSuggestions.classList.add("is-visible");
}

function openSong(id){

    songTitle.textContent =
        getSongTitle(id);

    songText.textContent =
        cleanSongText(songs[id]);

    modal.style.display = "block";
    document.body.classList.add("modal-open");
    modalSearchInput.value = "";
    modalSearchSuggestions.classList.remove("is-visible");
}

closeBtn.addEventListener("click", () => {

    modal.style.display = "none";
    document.body.classList.remove("modal-open");
    searchInput.value = "";
    searchSuggestions.innerHTML = "";
    searchSuggestions.classList.remove("is-visible");
    favoritesHeader.style.display = "block";
    favoritesList.style.display = "flex";
    songsHeader.style.display = "block";
    showAllSongs = false;
    renderSongs(songs);
    songsList.style.display = "flex";

});

function toggleFavorite(id){

    if(favorites.includes(id)){

        favorites =
            favorites.filter(
                fav => fav !== id
            );

    }else{

        favorites.push(id);
    }

    localStorage.setItem(
        "favorites",
        JSON.stringify(favorites)
    );

    const searchValue = searchInput.value.toLowerCase().trim();
    const visibleSongs = {};

    getMatchingSongIds(searchValue).forEach(matchingId => {
        visibleSongs[matchingId] = songs[matchingId];
    });

    renderSongs(searchValue ? visibleSongs : songs);

    renderFavorites();

    if(searchValue){
        renderSearchSuggestions(searchValue);
    }

    const modalSearchValue = modalSearchInput.value.toLowerCase().trim();

    if(modalSearchValue){
        renderModalSearchSuggestions(modalSearchValue);
    }
}

function renderFavorites(){

    favoritesList.innerHTML = "";

    favorites.forEach(id => {

        if(!songs[id]) return;

        const card =
            createSongCard(id);

        favoritesList.appendChild(card);

    });

}

searchInput.addEventListener("input", () => {

    const value =
        searchInput.value
        .toLowerCase();

    showAllSongs = false;

    const filtered = {};

    getMatchingSongIds(value).forEach(id => {
        filtered[id] = songs[id];
    });

    const isSearching = value.length > 0;

    favoritesHeader.style.display = isSearching ? "none" : "block";
    favoritesList.style.display = isSearching ? "none" : "flex";
    songsHeader.style.display = isSearching ? "none" : "block";
    searchSuggestions.classList.toggle("is-visible", isSearching);

    if(isSearching){
        renderSearchSuggestions(value);
    }

    renderSongs(filtered);
    songsList.style.display = isSearching ? "none" : "flex";
    showMoreBtn.style.display = isSearching
        ? "none"
        : (Object.keys(filtered).length > 10 ? "block" : "none");

});

showMoreBtn.addEventListener("click", () => {

    showAllSongs = !showAllSongs;

    const value =
        searchInput.value
        .toLowerCase();

    const filtered = {};

    getMatchingSongIds(value).forEach(id => {
        filtered[id] = songs[id];
    });

    renderSongs(filtered);

});

document.addEventListener("click", event => {

    if(!event.target.closest(".search-box")){
        searchSuggestions.classList.remove("is-visible");
    }

});

modalSearchInput.addEventListener("input", () => {

    const value = modalSearchInput.value.toLowerCase().trim();

    if(value){
        renderModalSearchSuggestions(value);
    }else{
        modalSearchSuggestions.classList.remove("is-visible");
    }

});