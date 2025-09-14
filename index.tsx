/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Modality } from '@google/genai';

const THEMES = [
  {
    name: 'Mughal',
    description:
      "A style flourishing under the Mughal Empire (16th-19th century), renowned for its detailed miniature paintings. Key elements include intricate 'hashiya' (floral borders), realistic portraiture often in profile, and lavish court or hunting scenes. The technique involves fine, delicate brushwork on wasli paper. The palette is rich with mineral- and vegetable-based pigments, featuring jewel tones like emerald green, ruby red, lapis lazuli blue, and opulent gold leaf for highlights.",
  },
  {
    name: 'Sufi',
    description:
      "An artistic expression of Islamic mysticism, focused on spirituality and introspection. This style utilizes ethereal ink and watercolor washes, creating soft, dreamlike textures. Symbolism is key, often featuring whirling dervishes, the 'al-nur' (divine light), and abstract calligraphic forms of sacred names. The palette is muted and contemplative—dominated by creams, earthy browns, soft celestial blues, and subtle gold accents to evoke a sense of inner peace and divine connection.",
  },
  {
    name: 'Sindhi',
    description:
      'Rooted in the ancient traditions of the Indus Valley Civilization, this theme is characterized by Ajrak, a unique form of block-printing. It involves a detailed 16-step process of washing, printing, and dyeing. Motifs are complex, symmetrical geometric patterns and stellar shapes. The color palette is strictly traditional, dominated by deep indigo blue (representing the night sky) and madder red (representing the earth and fire), with black and white creating sharp, graphic contrasts.',
  },
  {
    name: 'Pashtun',
    description:
      "A style that reflects the rugged, resilient, and proud heritage of the Pashtun tribes of Afghanistan and Pakistan. It draws heavily from tribal arts, particularly the bold, geometric patterns found in 'gilam' carpets and vibrant 'khamak' embroidery. Designs are often angular and symbolic, telling stories of tribe and family. The palette is warm and earthy, consisting of terracotta, ochre, deep crimson reds, and charcoal black, reflecting the mountainous landscapes and a deep connection to the land.",
  },
  {
    name: 'Balochi',
    description:
      "Celebrates the incredibly intricate and vibrant needlework of Balochistan. This style is defined by dense, geometric embroidery that covers entire garments. A key feature is 'shisha-dozi' (mirror work), where small mirrors are stitched into the fabric to ward off the evil eye and reflect the desert sun. The palette is a vivid explosion of primary colors—bright reds, yellows, oranges, and greens—often set against a black or deep-hued background, creating a dazzling contrast that mirrors the beauty and harshness of the desert landscape.",
  },
  {
    name: 'Turkish',
    description:
      "Drawing from the artistic golden age of the Ottoman Empire, this theme features the elegance of Iznik tile patterns, characterized by stylized tulips, carnations, and pomegranates. It incorporates sophisticated 'Diwani' or 'Tughra' calligraphy, often with flowing, interlaced letters. The art of 'Ebru' (paper marbling) can also be a textural element. The color palette is regal and striking, dominated by cobalt blue, turquoise, emerald green, and regal reds, with intricate details often highlighted in gold leaf.",
  },
];

const PHRASES = [
  {
    text: 'دل سے جو بات نکلتی ہے اثر رکھتی ہے',
    translation: 'Words from the heart have effect',
  },
  {
    text: 'بادشاہی صرف دلوں پر ہوتی ہے',
    translation: 'True sovereignty is only over hearts',
  },
  { text: 'محبت امن ہے', translation: 'Love is peace' },
  { text: 'پختون ولی', translation: 'The Pashtun code of honor' },
  {
    text: 'عشق میں رنگ ہے، روشنی ہے، زندگی ہے',
    translation: 'In love, there is color, light, and life',
  },
];

const LOADING_MESSAGES = [
  'Brewing artistic magic...',
  'Weaving cultural threads...',
  'Inking the calligraphy...',
  'Consulting the muses...',
  'Painting with pixels...',
];

// --- DOM ELEMENT REFERENCES ---
// Fix for line 218: Cast to HTMLInputElement to access 'value'.
const imageUpload = document.getElementById('image-upload') as HTMLInputElement;
const uploadLabel = document.getElementById('upload-label');
const imagePreviewContainer = document.getElementById(
  'image-preview-container',
);
// Fix for lines 201, 221: Cast to HTMLImageElement to access 'src'.
const imagePreview = document.getElementById('image-preview') as HTMLImageElement;
const removeImageBtn = document.getElementById(
  'remove-image-btn',
);
// Fix for line 236: Cast to HTMLSelectElement to access 'value'.
const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;
// Fix for line 237: Cast to HTMLSelectElement to access 'value'.
const phraseSelect = document.getElementById(
  'phrase-select',
) as HTMLSelectElement;
// Fix for lines 157, 204, 222, 308: Cast to HTMLButtonElement to access 'disabled'.
const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;

const outputPlaceholder = document.getElementById(
  'output-placeholder',
);
const loadingIndicator = document.getElementById(
  'loading-indicator',
);
const loadingText = document.getElementById('loading-text');
const resultContainer = document.getElementById(
  'result-container',
);
// Fix for line 176: Cast to HTMLImageElement to access 'src'.
const resultImage = document.getElementById('result-image') as HTMLImageElement;
const resultCaption = document.getElementById(
  'result-caption',
);
const errorContainer = document.getElementById(
  'error-container',
);
const errorMessage = document.getElementById('error-message');

// --- STATE ---
let uploadedFile = null;
let loadingInterval;

// --- HELPER FUNCTIONS ---

/**
 * Converts a File object to a base64 string.
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Fix for line 116: Property 'split' does not exist on type 'string | ArrayBuffer'.
      // Also corrects the logic to properly parse the MIME type from the data URL.
      const result = reader.result as string;
      const [header, data] = result.split(';base64,');
      const mimeType = header.split(':')[1];
      resolve({ mimeType, data });
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Populates the theme and phrase select dropdowns.
 */
function populateSelects() {
  THEMES.forEach((theme) => {
    const option = document.createElement('option');
    option.value = theme.name;
    option.textContent = theme.name;
    themeSelect.appendChild(option);
  });

  PHRASES.forEach((phrase) => {
    const option = document.createElement('option');
    option.value = phrase.text;
    option.textContent = `${phrase.text} (${phrase.translation})`;
    phraseSelect.appendChild(option);
  });
}

/**
 * Manages the visibility of different output panel states.
 */
function showOutputState(state) {
  outputPlaceholder.style.display = state === 'placeholder' ? 'block' : 'none';
  loadingIndicator.style.display = state === 'loading' ? 'block' : 'none';
  resultContainer.style.display = state === 'result' ? 'flex' : 'none';
  errorContainer.style.display = state === 'error' ? 'block' : 'none';
}

/**
 * Sets the loading state of the UI.
 */
function setLoadingState(isLoading) {
  generateBtn.disabled = isLoading;
  if (isLoading) {
    showOutputState('loading');
    let messageIndex = 0;
    loadingText.textContent = LOADING_MESSAGES[messageIndex];
    loadingInterval = window.setInterval(() => {
      messageIndex = (messageIndex + 1) % LOADING_MESSAGES.length;
      loadingText.textContent = LOADING_MESSAGES[messageIndex];
    }, 3000);
  } else {
    clearInterval(loadingInterval);
    showOutputState('placeholder');
  }
}

/**
 * Displays the generated artwork and caption.
 */
function displayResult(imageUrl, caption) {
  resultImage.src = imageUrl;
  resultCaption.textContent = caption;
  showOutputState('result');
}

/**
 * Displays an error message.
 */
function displayError(message) {
  errorMessage.textContent = message;
  showOutputState('error');
}

// --- EVENT HANDLERS ---

/**
 * Handles the file upload event.
 */
async function handleImageUpload(event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (file) {
    try {
      uploadedFile = await fileToBase64(file);
      imagePreview.src = `data:${uploadedFile.mimeType};base64,${uploadedFile.data}`;
      uploadLabel.style.display = 'none';
      imagePreviewContainer.style.display = 'block';
      generateBtn.disabled = false;
    } catch (error) {
      console.error('Error reading file:', error);
      displayError('Could not load image. Please try another file.');
      uploadedFile = null;
    }
  }
}

/**
 * Resets the image upload state.
 */
function removeImage() {
  uploadedFile = null;
  imageUpload.value = ''; // Reset file input
  uploadLabel.style.display = 'flex';
  imagePreviewContainer.style.display = 'none';
  imagePreview.src = '#';
  generateBtn.disabled = true;
}

/**
 * Main function to generate artwork via the Gemini API.
 */
async function generateArtwork(ai) {
  if (!uploadedFile) {
    displayError('Please upload a portrait first.');
    return;
  }

  setLoadingState(true);

  const selectedThemeName = themeSelect.value;
  const selectedPhraseText = phraseSelect.value;

  const selectedTheme = THEMES.find((t) => t.name === selectedThemeName);

  if (!selectedTheme) {
    displayError('Invalid theme selected.');
    setLoadingState(false);
    return;
  }

  const prompt = `
    You are an advanced image generation model. Your task is to transform the user-uploaded portrait into a culturally inspired artwork that blends South Asian and Middle Eastern aesthetics with elegant calligraphy.

    Instructions:
    1. Apply a visual style based on the selected cultural theme:
      - ${selectedTheme.name}: ${selectedTheme.description}

    2. Overlay Urdu or regional calligraphy in an appropriate script (e.g., Nastaliq, Shekasteh, or Diwani) using the following poetic or spiritual phrase:
      - "${selectedPhraseText}"

    3. Use elegant lighting, soft textures, and traditional motifs to evoke heritage, identity, and emotional depth.

    Output format:
    Return a high-resolution image with the transformed portrait, calligraphy overlay, and cultural styling.
    Also, return a short caption describing the selected theme and your artistic interpretation (e.g., "A portrait transformed with Sindhi serenity..." or "Pashtun pride embodied...").
  `;

  try {
    const imagePart = {
      inlineData: {
        mimeType: uploadedFile.mimeType,
        data: uploadedFile.data,
      },
    };

    const textPart = {
      text: prompt,
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: { parts: [imagePart, textPart] },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    let imageUrl = '';
    let caption = 'Artwork generated successfully.';

    for (const part of response.candidates[0].content.parts) {
      if (part.text) {
        caption = part.text;
      } else if (part.inlineData) {
        const base64ImageBytes = part.inlineData.data;
        imageUrl = `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
      }
    }

    if (imageUrl) {
      displayResult(imageUrl, caption);
    } else {
      displayError('The model did not return an image. Please try again.');
    }
  } catch (error) {
    console.error('API Error:', error);
    displayError(
      `An error occurred while generating the artwork. ${error instanceof Error ? error.message : ''}`,
    );
  } finally {
    setLoadingState(false);
    generateBtn.disabled = false;
  }
}

// --- INITIALIZATION ---
function main() {
  // NOTE: Replace "YOUR_API_KEY_HERE" with your actual Google Gemini API key.
  const apiKey = "YOUR_API_KEY_HERE";
  
  if (apiKey === "YOUR_API_KEY_HERE") {
    displayError(
      'API key is not configured. Please replace "YOUR_API_KEY_HERE" in index.tsx with your actual API key.',
    );
    return;
  }
  const ai = new GoogleGenAI({ apiKey: apiKey });

  populateSelects();

  imageUpload.addEventListener('change', handleImageUpload);
  removeImageBtn.addEventListener('click', removeImage);
  generateBtn.addEventListener('click', () => generateArtwork(ai));
}

main();
const apiKey = "AIzaSyDax1zB9X_wXMOEAbgY_VKdpOReOGQMm4g";
