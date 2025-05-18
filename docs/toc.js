// Populate the sidebar
//
// This is a script, and not included directly in the page, to control the total size of the book.
// The TOC contains an entry for each page, so if each page includes a copy of the TOC,
// the total size of the page becomes O(n**2).
class MDBookSidebarScrollbox extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {
        this.innerHTML = '<ol class="chapter"><li class="chapter-item expanded affix "><li class="spacer"></li><li class="chapter-item expanded affix "><a href="introduction.html">Introduction</a></li><li class="chapter-item expanded affix "><li class="part-title">Processes</li><li class="chapter-item expanded "><a href="process-run.html"><strong aria-hidden="true">1.</strong> Running a Process</a></li><li class="chapter-item expanded "><a href="process-output.html"><strong aria-hidden="true">2.</strong> Output</a></li><li class="chapter-item expanded "><a href="process-input.html"><strong aria-hidden="true">3.</strong> Input</a></li><li class="chapter-item expanded "><a href="process-stderr.html"><strong aria-hidden="true">4.</strong> Stderr and Error Handling</a></li><li class="chapter-item expanded affix "><li class="part-title">Input/Output</li><li class="chapter-item expanded "><a href="io/read.html"><strong aria-hidden="true">5.</strong> Reading Stuff</a></li><li class="chapter-item expanded "><div><strong aria-hidden="true">6.</strong> Writing Stuff</div></li><li class="chapter-item expanded affix "><li class="part-title">Higher Order Functions for AsyncIterable</li><li class="chapter-item expanded "><div><strong aria-hidden="true">7.</strong> Enumeration</div></li><li class="chapter-item expanded "><div><strong aria-hidden="true">8.</strong> Compatibility with Streams</div></li><li class="chapter-item expanded "><a href="performance.html"><strong aria-hidden="true">9.</strong> Performance</a></li><li class="chapter-item expanded affix "><li class="part-title">Concurrency and Parallel Processing</li><li class="chapter-item expanded affix "><li class="part-title">Miscellaneous</li><li class="chapter-item expanded "><a href="misc/sleep.html"><strong aria-hidden="true">10.</strong> Sleep</a></li><li class="chapter-item expanded "><div><strong aria-hidden="true">11.</strong> Range</div></li><li class="chapter-item expanded "><div><strong aria-hidden="true">12.</strong> Shuffle</div></li><li class="chapter-item expanded affix "><li class="part-title">Concepts</li><li class="chapter-item expanded "><a href="text-data.html"><strong aria-hidden="true">13.</strong> Working with Text Data</a></li><li class="chapter-item expanded "><a href="transform.html"><strong aria-hidden="true">14.</strong> Transformers</a></li><li class="chapter-item expanded affix "><li class="part-title">Examples</li><li class="chapter-item expanded "><div><strong aria-hidden="true">15.</strong> Embed a Bash Script</div></li><li class="chapter-item expanded "><a href="example-counting-words.html"><strong aria-hidden="true">16.</strong> Counting Words</a></li><li class="chapter-item expanded "><a href="example-concurrent-processing.html"><strong aria-hidden="true">17.</strong> Concurrent Processing</a></li><li class="chapter-item expanded "><a href="example-io.html"><strong aria-hidden="true">18.</strong> Input and Output</a></li></ol>';
        // Set the current, active page, and reveal it if it's hidden
        let current_page = document.location.href.toString().split("#")[0].split("?")[0];
        if (current_page.endsWith("/")) {
            current_page += "index.html";
        }
        var links = Array.prototype.slice.call(this.querySelectorAll("a"));
        var l = links.length;
        for (var i = 0; i < l; ++i) {
            var link = links[i];
            var href = link.getAttribute("href");
            if (href && !href.startsWith("#") && !/^(?:[a-z+]+:)?\/\//.test(href)) {
                link.href = path_to_root + href;
            }
            // The "index" page is supposed to alias the first chapter in the book.
            if (link.href === current_page || (i === 0 && path_to_root === "" && current_page.endsWith("/index.html"))) {
                link.classList.add("active");
                var parent = link.parentElement;
                if (parent && parent.classList.contains("chapter-item")) {
                    parent.classList.add("expanded");
                }
                while (parent) {
                    if (parent.tagName === "LI" && parent.previousElementSibling) {
                        if (parent.previousElementSibling.classList.contains("chapter-item")) {
                            parent.previousElementSibling.classList.add("expanded");
                        }
                    }
                    parent = parent.parentElement;
                }
            }
        }
        // Track and set sidebar scroll position
        this.addEventListener('click', function(e) {
            if (e.target.tagName === 'A') {
                sessionStorage.setItem('sidebar-scroll', this.scrollTop);
            }
        }, { passive: true });
        var sidebarScrollTop = sessionStorage.getItem('sidebar-scroll');
        sessionStorage.removeItem('sidebar-scroll');
        if (sidebarScrollTop) {
            // preserve sidebar scroll position when navigating via links within sidebar
            this.scrollTop = sidebarScrollTop;
        } else {
            // scroll sidebar to current active section when navigating via "next/previous chapter" buttons
            var activeSection = document.querySelector('#sidebar .active');
            if (activeSection) {
                activeSection.scrollIntoView({ block: 'center' });
            }
        }
        // Toggle buttons
        var sidebarAnchorToggles = document.querySelectorAll('#sidebar a.toggle');
        function toggleSection(ev) {
            ev.currentTarget.parentElement.classList.toggle('expanded');
        }
        Array.from(sidebarAnchorToggles).forEach(function (el) {
            el.addEventListener('click', toggleSection);
        });
    }
}
window.customElements.define("mdbook-sidebar-scrollbox", MDBookSidebarScrollbox);
