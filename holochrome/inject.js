(function() {
    var s = document.createElement('script');
    s.src = chrome.runtime.getURL('disableReload.js');
    s.onload = function() {
        this.parentNode.removeChild(this);
    };
    (document.head || document.documentElement).appendChild(s);
})()
