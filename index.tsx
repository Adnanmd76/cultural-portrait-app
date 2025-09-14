import { GoogleGenAI, Modality, Part } from "@google/genai";

// 1. API Key Setup
const apiKey = process.env.API_KEY;
if (!apiKey) {
    throw new Error("API_KEY environment variable is not set. Please configure it in your environment.");
}
const ai = new GoogleGenAI({ apiKey });

// 2. Constants and Data
const THEMES = [
    "South Asian", "Middle Eastern", "Japanese Ukiyo-e", "Chinese Ink Wash",
    "Persian Miniature", "Art Nouveau", "Cyberpunk",
];
const PHRASES = {
    "Love": "Love", "Peace": "Peace", "Hope": "Hope", "Wisdom": "Wisdom",
    "Courage": "Courage", "Custom...": "custom",
};
const CREATIVE_PROMPTS = [
    { id: 'mughal-fusion', title: 'Mughal Miniature Fusion', description: 'Blends intricate Mughal details with elegant Arabic calligraphy.', getPrompt: (phrase: string) => `Transform the portrait into a masterpiece fusing Mughal miniature aesthetics with the person's features. Use rich, detailed patterns and a vibrant color palette typical of the Mughal era. Artistically integrate the phrase "${phrase}" in elegant Arabic calligraphy, weaving it into the composition's background or attire.` },
    { id: 'ukiyo-e-modern', title: 'Modern Ukiyo-e', description: 'A modern take on Japanese woodblock prints with stylized lines.', getPrompt: (phrase: string) => `Reimagine the provided portrait in a modern Ukiyo-e style. Emphasize bold, stylized outlines, flat areas of color, and dynamic composition inspired by Japanese woodblock prints. Incorporate the phrase "${phrase}" using artistic, brush-stroke Japanese calligraphy (Shodo) as a key design element.` },
    { id: 'persian-cyberpunk', title: 'Persian Cyberpunk', description: 'A fusion of traditional Persian art with futuristic, neon aesthetics.', getPrompt: (phrase: string) => `Create a stunning Cyberpunk artwork heavily inspired by Persian miniature art. Blend traditional motifs, patterns, and architectural elements with futuristic neon lighting, cybernetic enhancements, and a high-tech feel. Integrate the phrase "${phrase}" as glowing, holographic Persian script within the scene.` },
    { id: 'art-nouveau-floral', title: 'Art Nouveau Floral', description: 'Flowing, organic lines and floral motifs in the Art Nouveau style.', getPrompt: (phrase: string) => `Convert the portrait into an elegant Art Nouveau illustration. Use flowing, organic lines, decorative patterns, and floral motifs to frame the subject. The color palette should be harmonious and sophisticated. The phrase "${phrase}" should be lettered in a flowing, decorative Art Nouveau typeface that complements the artwork.` }
];
const LOADING_TEXTS = [
    "Generating your masterpiece...", "Blending cultural aesthetics...", "Inking the calligraphy...",
    "Applying artistic touches...", "The final reveal is moments away...",
];

// 3. DOM Element References
const imageUploadInput = document.getElementById('image-upload') as HTMLInputElement;
const uploadLabel = document.getElementById('upload-label');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview') as HTMLImageElement;
const removeImageBtn = document.getElementById('remove-image-btn');
const manualControlsFieldset = document.getElementById('manual-controls-fieldset') as HTMLFieldSetElement;
const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;
const phraseSelect = document.getElementById('phrase-select') as HTMLSelectElement;
const customPhraseGroup = document.getElementById('custom-phrase-group');
const customPhraseInput = document.getElementById('custom-phrase-input') as HTMLInputElement;
const creativePromptsContainer = document.getElementById('creative-prompts-container');
const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
const outputPlaceholder = document.getElementById('output-placeholder');
const loadingIndicator = document.getElementById('loading-indicator');
const loadingTextElement = document.getElementById('loading-text');
const errorContainer = document.getElementById('error-container');
const errorMessageElement = document.getElementById('error-message');
const resultContainer = document.getElementById('result-container');
const resultImage = document.getElementById('result-image') as HTMLImageElement;
const resultCaption = document.getElementById('result-caption');
const downloadBtn = document.getElementById('download-btn');
const zoomContainer = document.getElementById('zoom-container');
const resetZoomBtn = document.getElementById('reset-zoom-btn');
const zoomLevelDisplay = document.getElementById('zoom-level-display');
const historyItemsContainer = document.getElementById('history-items-container');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const exportHistoryBtn = document.getElementById('export-history-btn');
const importHistoryBtn = document.getElementById('import-history-btn');
const importHistoryInput = document.getElementById('import-history-input') as HTMLInputElement;


// 4. App State
interface HistoryItem {
    id: string;
    imageUrl: string;
    caption: string;
}
let uploadedImageData: { base64: string; mimeType: string } | null = null;
let isGenerating = false;
let resultImageURL: string | null = null;
let loadingInterval: number;
let selectedCreativePrompt: ((phrase: string) => string) | null = null;
let generationHistory: HistoryItem[] = [];
let currentHistoryId: string | null = null;


// --- UI LOGIC ---

/** Populates select dropdowns with data */
function populateDropdowns() {
    THEMES.forEach(theme => {
        const option = document.createElement('option');
        option.value = theme;
        option.textContent = theme;
        themeSelect.appendChild(option);
    });
    Object.keys(PHRASES).forEach(phrase => {
        const option = document.createElement('option');
        option.value = PHRASES[phrase as keyof typeof PHRASES];
        option.textContent = phrase;
        phraseSelect.appendChild(option);
    });
}

/** Populates the creative prompts section */
function populateCreativePrompts() {
    const customCard = document.createElement('div');
    customCard.className = 'prompt-card active';
    customCard.id = 'prompt-card-custom';
    customCard.innerHTML = `<h4>Custom Setup</h4><p>Use the dropdowns above for a custom style.</p>`;
    customCard.addEventListener('click', () => {
        selectedCreativePrompt = null;
        manualControlsFieldset.disabled = false;
        document.querySelectorAll('.prompt-card').forEach(c => c.classList.remove('active'));
        customCard.classList.add('active');
    });
    creativePromptsContainer.appendChild(customCard);

    CREATIVE_PROMPTS.forEach(prompt => {
        const card = document.createElement('div');
        card.className = 'prompt-card';
        card.id = `prompt-card-${prompt.id}`;
        card.innerHTML = `<h4>${prompt.title}</h4><p>${prompt.description}</p>`;
        card.addEventListener('click', () => {
            selectedCreativePrompt = prompt.getPrompt;
            manualControlsFieldset.disabled = true;
            document.querySelectorAll('.prompt-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
        });
        creativePromptsContainer.appendChild(card);
    });
}

/** Handles file selection from upload input or drag-and-drop */
function handleFileSelect(file: File) {
    if (!file || !file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
    }
    const reader = new FileReader();
    reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        uploadedImageData = { base64: base64String, mimeType: file.type };
        imagePreview.src = `data:${file.type};base64,${base64String}`;
        uploadLabel!.style.display = 'none';
        imagePreviewContainer!.style.display = 'block';
        validateForm();
    };
    reader.readAsDataURL(file);
}

/** Removes the uploaded image and resets the UI */
function removeImage() {
    uploadedImageData = null;
    imageUploadInput.value = '';
    uploadLabel!.style.display = 'flex';
    imagePreviewContainer!.style.display = 'none';
    imagePreview.src = '#';
    validateForm();
}

/** Checks if the form is valid to enable the generate button */
function validateForm() {
    generateBtn.disabled = !uploadedImageData || isGenerating;
}

/** Updates the UI to show one of the panels: placeholder, loading, result, error */
function setOutputState(state: 'placeholder' | 'loading' | 'result' | 'error') {
    outputPlaceholder!.style.display = state === 'placeholder' ? 'block' : 'none';
    loadingIndicator!.style.display = state === 'loading' ? 'block' : 'none';
    resultContainer!.style.display = state === 'result' ? 'flex' : 'none';
    errorContainer!.style.display = state === 'error' ? 'block' : 'none';
    if (state === 'loading') {
        let i = 0;
        loadingTextElement!.textContent = LOADING_TEXTS[i];
        loadingInterval = window.setInterval(() => {
            i = (i + 1) % LOADING_TEXTS.length;
            loadingTextElement!.textContent = LOADING_TEXTS[i];
        }, 3000);
    } else {
        clearInterval(loadingInterval);
    }
}

/** Downloads the generated image */
function downloadImage() {
    if (!resultImageURL) return;
    const a = document.createElement('a');
    a.href = resultImageURL;
    a.download = 'cultural-portrait.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// --- ZOOM & PAN LOGIC ---
let scale = 1, panning = false, pointX = 0, pointY = 0, start = { x: 0, y: 0 };
function updateZoomDisplay() { zoomLevelDisplay!.textContent = `${Math.round(scale * 100)}%`; }
function setTransform() { resultImage.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`; }
function setupZoomAndPan() {
    updateZoomDisplay();
    zoomContainer!.onmousedown = (e) => { e.preventDefault(); start = { x: e.clientX - pointX, y: e.clientY - pointY }; panning = true; zoomContainer!.style.cursor = 'grabbing'; };
    zoomContainer!.onmouseup = () => { panning = false; zoomContainer!.style.cursor = 'grab'; };
    zoomContainer!.onmouseleave = () => { panning = false; zoomContainer!.style.cursor = 'grab'; };
    zoomContainer!.onmousemove = (e) => { if (!panning) return; pointX = (e.clientX - start.x); pointY = (e.clientY - start.y); setTransform(); };
    zoomContainer!.onwheel = (e) => {
        e.preventDefault();
        const rect = zoomContainer!.getBoundingClientRect();
        const xs = (e.clientX - rect.left - pointX) / scale;
        const ys = (e.clientY - rect.top - pointY) / scale;
        const delta = -e.deltaY;
        scale = Math.min(Math.max(0.25, scale * Math.pow(1.001, delta)), 4);
        pointX = e.clientX - rect.left - xs * scale;
        pointY = e.clientY - rect.top - ys * scale;
        setTransform();
        updateZoomDisplay();
    };
    resetZoomBtn!.onclick = () => { scale = 1; pointX = 0; pointY = 0; setTransform(); updateZoomDisplay(); };
}

// --- HISTORY LOGIC ---
function renderHistory() {
    historyItemsContainer!.innerHTML = '';
    if (generationHistory.length === 0) {
        historyItemsContainer!.innerHTML = `<p class="placeholder-text">Your generated images will appear here.</p>`;
        return;
    }
    generationHistory.forEach(item => {
        const historyItemEl = document.createElement('div');
        historyItemEl.className = 'history-item';
        historyItemEl.dataset.id = item.id;
        if (item.id === currentHistoryId) {
            historyItemEl.classList.add('active');
        }
        historyItemEl.innerHTML = `
            <img src="${item.imageUrl}" alt="History thumbnail" class="history-item-thumbnail">
            <div class="history-item-info">
                <p>${item.caption.substring(0, 50)}${item.caption.length > 50 ? '...' : ''}</p>
            </div>
        `;
        historyItemEl.addEventListener('click', () => loadFromHistory(item.id));
        historyItemsContainer!.appendChild(historyItemEl);
    });
}

function loadFromHistory(id: string) {
    const item = generationHistory.find(h => h.id === id);
    if (!item) return;
    currentHistoryId = id;
    resultImageURL = item.imageUrl;
    resultImage.src = resultImageURL;
    resultCaption.textContent = item.caption;
    setOutputState('result');
    // Highlight the active item
    document.querySelectorAll('.history-item').forEach(el => {
        el.classList.toggle('active', (el as HTMLElement).dataset.id === id);
    });
}

function addToHistory(imageUrl: string, caption: string) {
    const id = `hist-${Date.now()}`;
    const newItem: HistoryItem = { id, imageUrl, caption };
    currentHistoryId = id;
    generationHistory.unshift(newItem); // Add to the beginning
    if (generationHistory.length > 20) {
        generationHistory.pop(); // Limit history size
    }
    saveHistoryToLocalStorage();
    renderHistory();
}

function saveHistoryToLocalStorage() {
    localStorage.setItem('generationHistory', JSON.stringify(generationHistory));
}

function loadHistoryFromLocalStorage() {
    const savedHistory = localStorage.getItem('generationHistory');
    if (savedHistory) {
        generationHistory = JSON.parse(savedHistory);
    }
    renderHistory();
}

function clearHistory() {
    if (confirm('Are you sure you want to clear your entire generation history?')) {
        generationHistory = [];
        currentHistoryId = null;
        saveHistoryToLocalStorage();
        renderHistory();
    }
}

function exportHistory() {
    if (generationHistory.length === 0) {
        alert('History is empty. Nothing to export.');
        return;
    }
    const jsonString = JSON.stringify(generationHistory, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cultural-portrait-history-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importHistory() {
    importHistoryInput.click();
}

function handleHistoryFileSelected(file: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const importedData = JSON.parse(event.target!.result as string);
            if (!Array.isArray(importedData) || (importedData.length > 0 && (!importedData[0].id || !importedData[0].imageUrl || !importedData[0].caption))) {
                throw new Error('Invalid history file format.');
            }
            
            if (confirm('Merge imported history with your current history? Duplicates will be ignored.')) {
                const existingIds = new Set(generationHistory.map(item => item.id));
                const newItems = importedData.filter((item: HistoryItem) => !existingIds.has(item.id));
                
                if(newItems.length === 0) {
                    alert('No new items to import. All items in the file already exist in your history.');
                    return;
                }

                generationHistory = [...newItems, ...generationHistory];
                if (generationHistory.length > 20) {
                    generationHistory = generationHistory.slice(0, 20); // Re-apply limit
                }
                
                saveHistoryToLocalStorage();
                renderHistory();
                alert(`Successfully imported ${newItems.length} new items.`);
            }

        } catch (error) {
            alert('Failed to import history. Please make sure you are selecting a valid backup file.');
            console.error('History Import Error:', error);
        } finally {
            importHistoryInput.value = ''; // Reset input to allow re-importing the same file
        }
    };
    reader.readAsText(file);
}


// --- GEMINI API LOGIC ---
function handleGenerationError(error: any) {
    console.error("Artwork Generation Error:", error);
    let userMessage = 'An unexpected error occurred. Please refresh and try again.';
    if (error instanceof TypeError && error.message.toLowerCase().includes('fetch')) {
        userMessage = 'A network error occurred. Please check your internet connection and try again.';
    } else if (error && typeof error.message === 'string') {
        const message = error.message.toLowerCase();
        if (message.startsWith('api did not return an image')) {
            userMessage = error.message;
        } else if (message.includes('api key') || message.includes('permission denied')) {
            userMessage = 'There is an API configuration issue. Please contact the administrator.';
        } else if (message.includes('invalid argument')) {
            userMessage = 'The request was invalid. This might be due to an issue with the uploaded image. Please try a different one.';
        } else if (message.includes('resource has been exhausted') || message.includes('quota')) {
            userMessage = 'The service is currently at capacity. Please try again in a few moments.';
        } else {
            userMessage = error.message;
        }
    }
    errorMessageElement!.textContent = userMessage;
    setOutputState('error');
}

async function generateArtwork() {
    if (!uploadedImageData) { alert("Please upload a portrait first."); return; }
    isGenerating = true;
    validateForm();
    setOutputState('loading');
    try {
        let phrase = phraseSelect.value === 'custom' ? customPhraseInput.value : phraseSelect.value;
        if (!phrase) throw new Error("Please select or enter a calligraphy phrase.");

        let prompt: string;
        let themeForCaption: string;
        if (selectedCreativePrompt) {
            prompt = selectedCreativePrompt(phrase);
            const activePromptCard = document.querySelector('.prompt-card.active');
            themeForCaption = activePromptCard!.querySelector('h4')!.textContent!;
        } else {
            const theme = themeSelect.value;
            themeForCaption = theme;
            prompt = `Transform the provided portrait into a masterpiece with a ${theme} aesthetic. The style should be an artistic fusion, blending traditional patterns, colors, and motifs from that culture with the person's features. Please incorporate elegant, artistic calligraphy of the phrase "${phrase}" into the composition. The calligraphy should not obscure the face but rather complement it, perhaps woven into the background, attire, or as a decorative element. The final image should be a beautiful, culturally-inspired piece of art.`;
        }
        
        const imagePart: Part = { inlineData: { data: uploadedImageData.base64, mimeType: uploadedImageData.mimeType } };
        const textPart: Part = { text: prompt };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: [imagePart, textPart] },
            config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
        });

        const content = response.candidates?.[0]?.content;
        if (!content || !content.parts) throw new Error("Invalid response from the API.");

        const imagePartResponse = content.parts.find(p => p.inlineData);
        const textPartResponse = content.parts.find(p => p.text);
        
        if (!imagePartResponse || !imagePartResponse.inlineData) {
            throw new Error("API did not return an image. " + (textPartResponse?.text || "No additional details provided."));
        }
        
        const mimeType = imagePartResponse.inlineData.mimeType;
        const base64Data = imagePartResponse.inlineData.data;
        const captionText = textPartResponse?.text || `An artistic rendering in the ${themeForCaption} style.`;

        resultImageURL = `data:${mimeType};base64,${base64Data}`;
        resultImage.src = resultImageURL;
        resultCaption.textContent = captionText;

        setOutputState('result');
        addToHistory(resultImageURL, captionText);

    } catch (error: any) {
        handleGenerationError(error);
    } finally {
        isGenerating = false;
        validateForm();
    }
}

// --- INITIALIZATION ---
function initializeApp() {
    populateDropdowns();
    populateCreativePrompts();
    loadHistoryFromLocalStorage();

    // Event Listeners
    imageUploadInput.addEventListener('change', () => handleFileSelect(imageUploadInput.files![0]));
    uploadLabel!.addEventListener('dragover', (e) => { e.preventDefault(); uploadLabel!.classList.add('dragover'); });
    uploadLabel!.addEventListener('dragleave', () => uploadLabel!.classList.remove('dragover'));
    uploadLabel!.addEventListener('drop', (e) => { e.preventDefault(); uploadLabel!.classList.remove('dragover'); handleFileSelect(e.dataTransfer!.files[0]); });
    removeImageBtn!.addEventListener('click', removeImage);
    phraseSelect.addEventListener('change', () => { customPhraseGroup!.style.display = phraseSelect.value === 'custom' ? 'block' : 'none'; });
    generateBtn.addEventListener('click', generateArtwork);
    downloadBtn!.addEventListener('click', downloadImage);
    clearHistoryBtn!.addEventListener('click', clearHistory);
    exportHistoryBtn!.addEventListener('click', exportHistory);
    importHistoryBtn!.addEventListener('click', importHistory);
    importHistoryInput.addEventListener('change', () => handleHistoryFileSelected(importHistoryInput.files![0]));
    
    setupZoomAndPan();
    setOutputState('placeholder');
    validateForm();
}

initializeApp();
