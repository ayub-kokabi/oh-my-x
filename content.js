const XFilter = (() => {
  let settings = {};
  let debounceTimeout = null;
  let observer = null;
  
  const DEBOUNCE_DELAY = 300;
  const RETRY_INTERVAL = 500;

  const SELECTORS = {
    TAB: 'a[role="tab"]',
    CELL: '[data-testid="cellInnerDiv"]',
    ARTICLE: 'article',
    USER_NAME: '[data-testid="User-Name"] a',
    TWEET_TEXT: '[data-testid="tweetText"]',
    TIMELINE: 'div[aria-label="Home timeline"]'
  };

  const isForYouTabActive = () => {
    const tabs = document.querySelectorAll(SELECTORS.TAB);
    
    for (const tab of tabs) {
      const span = tab.querySelector('span');
      if (span?.textContent === 'For you') {
        return tab.getAttribute('aria-selected') === 'true';
      }
    }
    return false;
  };

  const isOnHomePage = () => window.location.pathname === '/home';

  const extractAuthorHandle = (authorElement) => {
    if (!authorElement?.href) return '';
    return authorElement.href.split('/').pop();
  };

  const shouldFilterPost = (post) => {
    if (!post.querySelector(SELECTORS.ARTICLE)) {
      return { shouldFilter: false, isValidPost: false };
    }

    const authorElement = post.querySelector(SELECTORS.USER_NAME);
    const postTextElement = post.querySelector(SELECTORS.TWEET_TEXT);
    const authorHandle = extractAuthorHandle(authorElement);

    // Never filter posts from excluded accounts
    if (settings.excludeAccounts?.includes(authorHandle)) {
      return { shouldFilter: false, isValidPost: true };
    }

    // Filter posts with no text if setting is enabled
    if (settings.hideNoText && !postTextElement) {
      return { shouldFilter: true, isValidPost: true };
    }

    // Filter by language
    if (postTextElement && settings.allowedLangs?.length > 0) {
      const postLang = postTextElement.getAttribute('lang');
      if (!settings.allowedLangs.includes(postLang)) {
        return { shouldFilter: true, isValidPost: true };
      }
    }

    return { shouldFilter: false, isValidPost: true };
  };

  const applyVisibility = (element, isVisible) => {
    if (!element) return;
    
    // Use requestAnimationFrame for smoother updates
    requestAnimationFrame(() => {
      element.style.display = isVisible ? '' : 'none';
    });
  };

  const filterFeed = () => {
    if (!isOnHomePage() || !isForYouTabActive()) {
      return;
    }

    const posts = document.querySelectorAll(SELECTORS.CELL);
    
    posts.forEach(post => {
      const { shouldFilter, isValidPost } = shouldFilterPost(post);
      
      if (isValidPost) {
        applyVisibility(post, !shouldFilter);
      }
    });
  };

  const debouncedFilter = () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(filterFeed, DEBOUNCE_DELAY);
  };

  const resetAllPosts = () => {
    document.querySelectorAll(SELECTORS.CELL).forEach(post => {
      applyVisibility(post, true);
    });
  };

  const createObserver = () => {
    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver(debouncedFilter);
    return observer;
  };

  const observeTimeline = () => {
    const timeline = document.querySelector(SELECTORS.TIMELINE);
    
    if (timeline) {
      const obs = createObserver();
      obs.observe(timeline, { 
        childList: true, 
        subtree: true 
      });
    } else {
      setTimeout(observeTimeline, RETRY_INTERVAL);
    }
  };

  const handleStorageChange = (changes) => {
    if (changes.settings) {
      settings = changes.settings.newValue || {};
      resetAllPosts();
      filterFeed();
    }
  };

  const loadSettings = async () => {
    try {
      const data = await chrome.storage.sync.get('settings');
      // Use empty object as default if no settings exist
      settings = data.settings || {};
      return settings;
    } catch (error) {
      console.error('Error loading settings:', error);
      settings = {};
      return settings;
    }
  };

  const initialize = async () => {
    try {
      await loadSettings();
      filterFeed();
      chrome.storage.onChanged.addListener(handleStorageChange);
      observeTimeline();
    } catch (error) {
      console.error('Extension initialization error:', error);
    }
  };

  const cleanup = () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    clearTimeout(debounceTimeout);
    chrome.storage.onChanged.removeListener(handleStorageChange);
  };

  return {
    initialize,
    cleanup,
    filterFeed
  };
})();

XFilter.initialize();