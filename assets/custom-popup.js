/**
 * custom-popup.js
 * 
 * Handles the logic for Phase 3: Product Popup & Cart Integration.
 * - Opens popup on grid card "+" click
 * - Dynamically renders product data and options
 * - Resolves selected variants
 * - Handles Add to Cart with the special "Black + Medium" -> "Soft Winter Jacket" rule
 * - No jQuery, vanilla JS only.
 */

document.addEventListener('DOMContentLoaded', () => {
  const popup = document.getElementById('custom-popup');
  if (!popup) return;

  const elements = {
    closeBtns: popup.querySelectorAll('[data-popup-close]'),
    image: popup.querySelector('#popup-image'),
    title: popup.querySelector('#popup-title'),
    price: popup.querySelector('#popup-price'),
    description: popup.querySelector('#popup-description'),
    optionsContainer: popup.querySelector('#popup-options'),
    variantIdInput: popup.querySelector('#popup-variant-id'),
    submitBtn: popup.querySelector('#popup-add-to-cart'),
    submitText: popup.querySelector('.popup-custom__submit-text'),
    errorMsg: popup.querySelector('#popup-error'),
    form: popup.querySelector('#popup-form')
  };

  let currentProductData = null;
  let currentSelectedOptions = [];

  // 1. Open Popup Event Listeners
  const gridTriggers = document.querySelectorAll('[data-grid-popup-trigger]');
  gridTriggers.forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      const card = trigger.closest('.grid-custom__card');
      const jsonScript = card.querySelector('.grid-custom__product-json');
      
      if (jsonScript) {
        try {
          const productData = JSON.parse(jsonScript.textContent);
          openPopup(productData);
        } catch (error) {
          console.error("Error parsing product JSON", error);
        }
      }
    });
  });

  // 2. Close Popup Logic
  elements.closeBtns.forEach(btn => {
    btn.addEventListener('click', closePopup);
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && popup.classList.contains('is-open')) {
      closePopup();
    }
  });

  function closePopup() {
    popup.classList.remove('is-open');
    popup.setAttribute('aria-hidden', 'true');
    // reset visual states
    setTimeout(() => {
      elements.errorMsg.textContent = '';
      resetButtonState();
    }, 300);
  }

  function openPopup(productData) {
    currentProductData = productData;
    
    // Populate Image
    if (productData.featured_image) {
      elements.image.src = productData.featured_image;
      elements.image.alt = productData.title;
    } else {
      elements.image.src = '';
    }

    // Populate Text Data
    elements.title.textContent = productData.title;
    elements.description.innerHTML = productData.description;

    // Reset Form
    elements.errorMsg.textContent = '';
    resetButtonState();

    // Render Options UI
    renderOptions(productData);

    // Initial Variant Selection
    updateVariantSelection();

    // Show Popup
    popup.classList.add('is-open');
    popup.setAttribute('aria-hidden', 'false');
    // Set focus to modal for accessibility
    elements.closeBtns[0].focus();
  }

  function renderOptions(productData) {
    elements.optionsContainer.innerHTML = '';
    
    if (!productData.options || productData.options.length === 0) return;

    // If only one option and it's "Title" with value "Default Title" (standard Shopify behavior for no variants)
    if (productData.options.length === 1 && productData.options[0].name === 'Title' && productData.options[0].values.includes('Default Title')) {
      return; 
    }

    productData.options.forEach((option, index) => {
      const optionPosition = `option${option.position}`; // option1, option2, option3
      
      const groupDiv = document.createElement('div');
      groupDiv.className = 'popup-custom__option-group';
      
      const label = document.createElement('label');
      label.className = 'popup-custom__option-name';
      label.textContent = option.name;
      groupDiv.appendChild(label);

      // Rule: "Color" renders as Radio Buttons, "Size" renders as Select Dropdown
      // Using generic fallback to Select for other options
      if (option.name.toLowerCase() === 'color' || option.name.toLowerCase() === 'colour') {
        const radioWrapper = document.createElement('div');
        radioWrapper.className = 'popup-custom__option-values--radio';
        
        option.values.forEach((val, i) => {
          const wrapper = document.createElement('div');
          wrapper.className = 'popup-custom__radio-wrapper';
          
          const inputId = `option-${option.position}-${i}`;
          
          const input = document.createElement('input');
          input.type = 'radio';
          input.name = optionPosition;
          input.value = val;
          input.id = inputId;
          input.className = 'popup-custom__radio-input';
          // Select first available or just first
          if (i === 0) input.checked = true;

          const lbl = document.createElement('label');
          lbl.htmlFor = inputId;
          lbl.className = 'popup-custom__radio-label';
          lbl.textContent = val;

          // Event listener for change
          input.addEventListener('change', updateVariantSelection);

          wrapper.appendChild(input);
          wrapper.appendChild(lbl);
          radioWrapper.appendChild(wrapper);
        });
        groupDiv.appendChild(radioWrapper);

      } else {
        // Render as Select Dropdown
        const selectWrapper = document.createElement('div');
        selectWrapper.className = 'popup-custom__select-wrapper';
        
        const select = document.createElement('select');
        select.name = optionPosition;
        select.className = 'popup-custom__select';
        
        // As per Figma spec request, assume placeholder "Choose your size" (optional, but requested implicitly)
        // Since we need a default, we just select the first value to ensure a valid variant ID
        option.values.forEach((val) => {
          const opt = document.createElement('option');
          opt.value = val;
          opt.textContent = val;
          select.appendChild(opt);
        });

        // Add chevron icon
        const iconSvg = `<svg class="popup-custom__select-icon" width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1.5L6 6.5L11 1.5" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        selectWrapper.innerHTML = iconSvg;
        selectWrapper.insertBefore(select, selectWrapper.firstChild);

        select.addEventListener('change', updateVariantSelection);
        groupDiv.appendChild(selectWrapper);
      }

      elements.optionsContainer.appendChild(groupDiv);
    });
  }

  function updateVariantSelection() {
    if (!currentProductData) return;

    // 1. Gather selected values from DOM
    currentSelectedOptions = [];
    const inputs = elements.optionsContainer.querySelectorAll('input:checked, select');
    
    let optionMap = {
      option1: null,
      option2: null,
      option3: null
    };

    inputs.forEach(input => {
      optionMap[input.name] = input.value;
      currentSelectedOptions.push(input.value);
    });

    // 2. Find matching variant
    let matchedVariant = null;
    
    // If product has no true variants
    if (currentProductData.variants.length === 1 && currentProductData.variants[0].title === 'Default Title') {
       matchedVariant = currentProductData.variants[0];
    } else {
      matchedVariant = currentProductData.variants.find(v => {
        let match1 = optionMap.option1 ? v.option1 === optionMap.option1 : true;
        let match2 = optionMap.option2 ? v.option2 === optionMap.option2 : true;
        let match3 = optionMap.option3 ? v.option3 === optionMap.option3 : true;
        return match1 && match2 && match3;
      });
    }

    // 3. Update UI based on matched variant
    if (matchedVariant) {
      elements.variantIdInput.value = matchedVariant.id;
      elements.price.textContent = matchedVariant.price_formatted;
      
      // Optionally update image if variant has a specific image
      if (matchedVariant.featured_image) {
        elements.image.src = matchedVariant.featured_image;
      }

      if (matchedVariant.available) {
        elements.submitBtn.disabled = false;
        elements.submitText.textContent = "ADD TO CART ->";
      } else {
        elements.submitBtn.disabled = true;
        elements.submitText.textContent = "SOLD OUT";
      }
    } else {
      // Variant combination doesn't exist
      elements.variantIdInput.value = "";
      elements.price.textContent = "Unavailable";
      elements.submitBtn.disabled = true;
      elements.submitText.textContent = "UNAVAILABLE";
    }
  }

  // 3. Add to Cart Form Submission
  elements.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const variantId = elements.variantIdInput.value;
    if (!variantId) return;

    elements.errorMsg.textContent = '';
    setButtonLoading(true);

    const itemsToAdd = [];
    itemsToAdd.push({
      id: parseInt(variantId),
      quantity: 1
    });

    // --- Special Cart Rule Logic ---
    // If the selected options contain BOTH "Black" and "Medium"
    // Note: Checking the active values dynamically as requested
    const hasBlack = currentSelectedOptions.some(val => typeof val === 'string' && val.toLowerCase() === 'black');
    const hasMedium = currentSelectedOptions.some(val => typeof val === 'string' && val.toLowerCase() === 'medium');

    if (hasBlack && hasMedium) {
      try {
        // Fetch the Soft Winter Jacket data dynamically
        const response = await fetch('/products/soft-winter-jacket.js');
        if (response.ok) {
          const jacketData = await response.json();
          // Find first available variant of the jacket
          const jacketVariant = jacketData.variants.find(v => v.available);
          if (jacketVariant) {
            itemsToAdd.push({
              id: jacketVariant.id,
              quantity: 1
            });
            console.log("Special Rule Triggered: Adding Soft Winter Jacket (Variant ID: " + jacketVariant.id + ")");
          }
        } else {
          console.warn("Could not fetch soft-winter-jacket product data.");
        }
      } catch (err) {
        console.error("Error fetching special rule product:", err);
      }
    }
    // --------------------------------

    // Execute Cart API Request
    try {
      const cartRes = await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          items: itemsToAdd
        })
      });

      if (!cartRes.ok) {
        const errorData = await cartRes.json();
        throw new Error(errorData.description || 'Error adding to cart');
      }

      // Success Feedback
      setButtonSuccess();
      
      // Close popup after a short delay
      setTimeout(() => {
        closePopup();
        // Optional: trigger cart drawer open or header cart count update here
        // Using native Dawn cart update event if available
        document.documentElement.dispatchEvent(new CustomEvent('cart:updated', {
          bubbles: true
        }));
      }, 1000);

    } catch (err) {
      elements.errorMsg.textContent = err.message;
      setButtonLoading(false);
    }
  });

  function setButtonLoading(isLoading) {
    if (isLoading) {
      elements.submitBtn.disabled = true;
      elements.submitBtn.classList.add('is-loading');
    } else {
      elements.submitBtn.disabled = false;
      elements.submitBtn.classList.remove('is-loading');
    }
  }

  function setButtonSuccess() {
    elements.submitBtn.classList.remove('is-loading');
    elements.submitText.textContent = "ADDED!";
    // keep it disabled briefly so user doesn't double click
  }

  function resetButtonState() {
    elements.submitBtn.classList.remove('is-loading');
    elements.submitBtn.disabled = false;
    elements.submitText.textContent = "ADD TO CART ->";
  }

});
