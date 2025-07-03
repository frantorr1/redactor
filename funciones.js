// —————— Elementos del DOM y constantes ——————
const editor = document.getElementById("editor");
const preview = document.getElementById("preview");
const downloadBtn = document.getElementById("download");
const ALLOWED_TAGS = /<\/?(b|i|u|br)\b[^>]*>/gi;
const MAX_LINES = 150;
const MAX_CHARACTERS = 256;
const TOTAL_CHAR_LIMIT = 38400;
let hadContent = false;


function htmlToTxt(html) {
  return html
    // 1) Si hay <b>, <i> o <u> (cualquiera y anidados) *únicamente* alrededor de un <br>, lo convertimos en un bare <br>
    .replace(
      /<(?:b|i|u)[^>]*>\s*(?:(?:<(?:b|i|u)[^>]*>)*\s*<br>\s*(?:<\/(?:b|i|u)>)*\s*)+<\/(?:b|i|u)>/gi,
      "<br>"
    )
    // 2) El resto de tu pipeline:
    .replace(/^<div><br><\/div>/i, "")       // quita posible salto inicial vacío
    .replace(/<div><br><\/div>/gi, "<br>")   // cada Enter vacío → <br>
    .replace(/<div>/gi, "<br>")              // cada nueva línea → <br>
    .replace(/<\/div>/gi, "")                // quita cierres de div
    .replace(/<p>(.*?)<\/p>/gi, "$1<br>")    // párrafos → texto + <br>
    .replace(/<span[^>]*>(.*?)<\/span>/gi, "$1")  // quita spans pero conserva contenido
    .replace(/&nbsp;/gi, " ")                // convierte &nbsp; en espacio
    .trim();
}



// —————— Cuenta líneas según “<br>” ——————
function countLines() {
    return editor.querySelectorAll(":scope > div").length;
}

// —————— Actualiza el contador ——————
function updateCounter() {
    if (!editor.innerText.trim()) {
        counter.textContent =
            `Líneas: 0 / ${MAX_LINES} – Línea actual: 0/${MAX_CHARACTERS} – ` +
            `Total caracteres: 0 / ${TOTAL_CHAR_LIMIT}`;
        return;
    }
    // 1) Genera el texto con <br> para cada salto
    const txt = htmlToTxt(editor.innerHTML);
    // 2) Si está vacío, mostramos 1 línea vacía
    if (!txt) {
        counter.textContent =
            `Líneas: 1 / ${MAX_LINES} – Línea actual: 0/${MAX_CHARACTERS} – ` +
            `Total caracteres: 0 / ${TOTAL_CHAR_LIMIT}`;
        return;
    }
    // 3) Partimos en cada <br> para contar líneas y caracteres
    const parts = txt.split(/<br>/gi);
    const lines = parts.length;
    const total = parts.reduce((sum, p) => sum + p.length, 0);
    const current = parts[parts.length - 1].length;

    counter.textContent =
        `Líneas: ${lines} / ${MAX_LINES} – ` +
        `Línea actual: ${current}/${MAX_CHARACTERS} – ` +
        `Total caracteres: ${total} / ${TOTAL_CHAR_LIMIT}`;
}

function syncPreview() {
    // 1) Si no hay ni un solo carácter (ni espacios), borramos TODO el innerHTML
    if (editor.innerText.trim() === "") {
        editor.innerHTML = "";
        preview.textContent = "";
        updateCounter();
        return;
    }

    // 2) En caso contrario, convertimos y pintamos normalmente
    const txt = htmlToTxt(editor.innerHTML);
    preview.textContent = txt;
    updateCounter();
}


// —————— Forzar refresco inmediato al pulsar Enter ——————
editor.addEventListener("keydown", e => {
    if (e.key === "Enter") {
        setTimeout(syncPreview, 0);
    }
});

// —————— Prevención de exceso ——————
editor.addEventListener("keydown", e => {
    if (e.key === "Enter" && countLines() >= MAX_LINES) {
        e.preventDefault();
    }
});
editor.addEventListener("beforeinput", e => {
    if (e.inputType === "insertText" && e.data && !/\r|\n/.test(e.data)) {
        const current = editor.innerText.replace(/\r\n?/g, "\n").split("\n").pop();
        if (current.length >= MAX_CHARACTERS) e.preventDefault();
    }
});
editor.addEventListener("paste", e => {
    e.preventDefault();
    const paste = e.clipboardData.getData("text/plain");
    let lines = paste.split(/\r?\n/).map(l => l.slice(0, MAX_CHARACTERS));
    let toInsert = lines.join("\n");
    const avail = TOTAL_CHAR_LIMIT - editor.innerText.replace(/\r\n?/g, "\n").replace(/^\n+|\n+$/g, "").length;
    if (toInsert.length > avail) toInsert = toInsert.slice(0, avail);
    document.execCommand("insertText", false, toInsert);
});

// —————— Validación de etiquetas HTML ——————
function validar(html) {
    const restante = html.replace(ALLOWED_TAGS, "");
    return !/<[^>]+>/.test(restante);
}

// —————— Generación y descarga del TXT ——————
function downloadTxt() {
    const txt = htmlToTxt(editor.innerHTML);
    const plain = editor.innerText.replace(/\r\n?/g, "\n").replace(/^\n+|\n+$/g, "");

    if (!plain) return alert("El mensaje está vacío");
    if (!validar(txt)) return alert("⚠️ Hay etiquetas no permitidas.");

    const lines = plain.split("\n").length;
    const totalChars = plain.replace(/\n/g, "").length;
    if (lines > MAX_LINES) return alert(`⚠️ Máx ${MAX_LINES} líneas`);
    plain.split("\n").forEach((l, i) => {
        if (l.length > MAX_CHARACTERS)
            alert(`⚠️ Línea ${i + 1} supera ${MAX_CHARACTERS} caracteres.`);
    });
    if (totalChars > TOTAL_CHAR_LIMIT)
        return alert(`⚠️ Máx ${TOTAL_CHAR_LIMIT} caracteres totales`);

    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "GPJOCLIA.TXT";
    a.click();
    URL.revokeObjectURL(url);
}

// —————— Toolbar de formato ——————
function updateStates() {
    document.querySelectorAll("#toolbar button[data-cmd]").forEach(btn => {
        btn.classList.toggle("active",
            document.queryCommandState(btn.dataset.cmd)
        );
    });
    syncPreview();
}
document.querySelectorAll("#toolbar button[data-cmd]").forEach(btn => {
    btn.addEventListener("click", () => {
        document.execCommand(btn.dataset.cmd, false, null);
        updateStates();
    });
});
document.getElementById("clear-btn").addEventListener("click", () => {
    document.execCommand("selectAll", false, null);
    document.execCommand("removeFormat", false, null);
    updateStates();
});

// —————— Eventos generales e inicialización ——————
editor.addEventListener("input", syncPreview);
editor.addEventListener("keyup", syncPreview);
editor.addEventListener("mouseup", syncPreview);
downloadBtn.addEventListener("click", downloadTxt);

// Primera carga
syncPreview();
