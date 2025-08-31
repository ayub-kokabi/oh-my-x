const XFilter = (() => {
  let settings = {};
  let debounceTimeout = null;
  let observer = null;
  let lastFilterTime = 0;
  
  const DEBOUNCE_DELAY = 300;
  const RETRY_INTERVAL = 500;
  const REFILTER_INTERVAL = 1000;

  const SELECTORS = {
    TAB: 'a[role="tab"]',
    CELL: '[data-testid="cellInnerDiv"]',
    ARTICLE: 'article',
    USER_NAME: '[data-testid="User-Name"] a',
    TWEET_TEXT: '[data-testid="tweetText"]',
    TIMELINE: 'div[aria-label="Home timeline"]'
  };

  const isOnHomePage = () => {
    const path = window.location.pathname;
    return path === '/home' || path === '/' || path.startsWith('/home/');
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
    
    element.dataset.xfiltered = isVisible ? 'false' : 'true';
    
    requestAnimationFrame(() => {
      element.style.display = isVisible ? '' : 'none';
    });
  };

  const filterFeed = (force = false) => {
    if (!isOnHomePage() || !isForYouTabActive()) {
      return;
    }

    const now = Date.now();
    // Prevent filtering too frequently
    if (!force && now - lastFilterTime < 100) {
      return;
    }
    lastFilterTime = now;

    const posts = document.querySelectorAll(SELECTORS.CELL);
    
    posts.forEach(post => {
      const wasFiltered = post.dataset.xfiltered === 'true';
      const { shouldFilter, isValidPost } = shouldFilterPost(post);
      
      if (isValidPost) {
        // Only apply if state changed
        if (shouldFilter !== wasFiltered) {
          applyVisibility(post, !shouldFilter);
        }
      }
    });
  };

  const debouncedFilter = () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => filterFeed(false), DEBOUNCE_DELAY);
  };

  const resetAllPosts = () => {
    document.querySelectorAll(SELECTORS.CELL).forEach(post => {
      delete post.dataset.xfiltered;
      applyVisibility(post, true);
    });
  };

  const createObserver = () => {
    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver((mutations) => {
      let shouldFilter = false;
      
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0 || 
            mutation.removedNodes.length > 0) {
          shouldFilter = true;
          break;
        }
      }
      
      if (shouldFilter) {
        debouncedFilter();
      }
    });
    
    return observer;
  };

  const observeTimeline = () => {
    const timeline = document.querySelector(SELECTORS.TIMELINE);
    
    if (timeline) {
      const obs = createObserver();
      obs.observe(timeline, { 
        childList: true, 
        subtree: true,
        attributes: false
      });
      
      filterFeed(true);
    } else {
      setTimeout(observeTimeline, RETRY_INTERVAL);
    }
  };

  const startPeriodicCheck = () => {
    setInterval(() => {
      if (isOnHomePage() && isForYouTabActive()) {
        filterFeed(false);
      }
    }, REFILTER_INTERVAL);
  };

  const handleUrlChange = () => {
    if (isOnHomePage()) {
      setTimeout(() => {
        observeTimeline();
        filterFeed(true);
      }, 500);
    } else {
      if (observer) {
        observer.disconnect();
      }
    }
  };

  const setupNavigationListeners = () => {
    // Detect URL changes in SPA
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        handleUrlChange();
      }
    }).observe(document, { subtree: true, childList: true });

    window.addEventListener('popstate', handleUrlChange);
    
    if (window.navigation) {
      window.navigation.addEventListener('navigate', handleUrlChange);
    }
  };

  const handleStorageChange = (changes) => {
    if (changes.settings) {
      settings = changes.settings.newValue || {};
      resetAllPosts();
      filterFeed(true);
    }
  };

  const loadSettings = async () => {
    try {
      const data = await chrome.storage.sync.get('settings');
      settings = data.settings || {};
      return settings;
    } catch (error) {
      settings = {};
      return settings;
    }
  };

  const initialize = async () => {
    try {
      await loadSettings();
      
      chrome.storage.onChanged.addListener(handleStorageChange);
      setupNavigationListeners();
      observeTimeline();
      startPeriodicCheck();
      
    } catch (error) {
      // Silent fail
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