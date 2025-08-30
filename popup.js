const PopupController = (() => {
  let elements = {};
  let languageSelect = null;

  const STATUS_DISPLAY_TIME = 2000;

  const initElements = () => {
    elements = {
      hideNoText: document.getElementById('hideNoText'),
      excludeAccounts: document.getElementById('excludeAccounts'),
      saveButton: document.getElementById('saveButton'),
      status: document.getElementById('status'),
      setupNotice: document.getElementById('setupNotice')
    };
  };

  const initLanguageSelect = () => {
    const dataForSelect = Languages.data.map(lang => ({
      text: lang.name,
      value: lang.lang
    }));

    languageSelect = new SlimSelect({
      select: '#language-select',
      settings: {
        placeholderText: 'Select Languages',
        searchPlaceholder: 'Search...',
        maxSelected: 10
      },
      data: dataForSelect
    });
  };

  const parseAccounts = (text) => {
    return text
      .split('\n')
      .map(acc => acc.trim().replace('@', ''))
      .filter(Boolean);
  };

  const validateSettings = (settings) => {
    const errors = [];

    if (settings.excludeAccounts.some(acc => acc.includes(' '))) {
      errors.push('Account names cannot contain spaces');
    }

    return errors;
  };

  const showStatus = (message, isError = false) => {
    elements.status.textContent = message;
    elements.status.style.color = isError ? 'red' : 'green';

    if (!isError) {
      setTimeout(() => {
        elements.status.textContent = '';
      }, STATUS_DISPLAY_TIME);
    }
  };

  const hasExistingSettings = (settings) => {
    return settings && (
      (settings.allowedLangs && settings.allowedLangs.length > 0) ||
      settings.hideNoText === true ||
      (settings.excludeAccounts && settings.excludeAccounts.length > 0)
    );
  };

  const saveSettings = async () => {
    try {
      const selectedLangs = languageSelect.getSelected();
      const accounts = parseAccounts(elements.excludeAccounts.value);

      const settings = {
        allowedLangs: selectedLangs,
        hideNoText: elements.hideNoText.checked,
        excludeAccounts: accounts
      };

      const errors = validateSettings(settings);
      if (errors.length > 0) {
        showStatus(errors[0], true);
        return;
      }

      await chrome.storage.sync.set({ settings });

      elements.setupNotice.style.display = 'none';

      showStatus('Settings saved!');
    } catch (error) {
      console.error('Error saving settings:', error);
      showStatus('Error saving settings', true);
    }
  };

  const loadSettings = async () => {
    try {
      const data = await chrome.storage.sync.get('settings');
      const settings = data.settings;

      if (!hasExistingSettings(settings)) {
        elements.setupNotice.style.display = 'block';
        languageSelect.setSelected([]);
        elements.hideNoText.checked = false;
        elements.excludeAccounts.value = '';
      } else {
        elements.setupNotice.style.display = 'none';
        languageSelect.setSelected(settings.allowedLangs || []);
        elements.hideNoText.checked = settings.hideNoText || false;
        elements.excludeAccounts.value = (settings.excludeAccounts || []).join('\n');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      showStatus('Error loading settings', true);
    }
  };
  
  const init = () => {
    initElements();
    initLanguageSelect();

    elements.saveButton.addEventListener('click', saveSettings);

    loadSettings();
  };

  return {
    init
  };
})();

document.addEventListener('DOMContentLoaded', PopupController.init);