/* eslint strict: ["warn", "function"] */
// IIFE is here so we don't pollute the window
((exports => {
	'use strict';

	// Create the global Pa11y variable
	/* eslint-disable no-underscore-dangle */
	const pa11y = exports.__pa11y = {
		getElementContext,
		getElementSelector,
		run: runPa11y,
		runners: {}
	};
	/* eslint-disable no-underscore-dangle */

	/**
	 * A map of issue names to type codes.
	 * @private
	 */
	const issueCodeMap = {
		unknown: 0,
		error: 1,
		warning: 2,
		notice: 3
	};

	/**
	 * Run Pa11y on the current page.
	 * @public
	 * @param {Object} options - Options to use when running tests.
	 * @returns {Promise} Returns a promise which resolves with test results.
	 */
	async function runPa11y(options) {
		pa11y.version = options.pa11yVersion;

		await wait(options.wait);

		// Set up the result object
		const result = {
			documentTitle: window.document.title || '',
			pageUrl: window.location.href || '',
			issues: []
		};

		// Execute all of the runners and process issues
		for (const runner of options.runners) {
			const runnerIssues = await pa11y.runners[runner](options, pa11y);
			runnerIssues.map(issue => {
				issue.runner = runner;
				return issue;
			});
			result.issues = result.issues.concat(runnerIssues);
		}
		result.issues = processIssues(result.issues);

		// Return the result object
		return result;

		/**
		 * Process issues from a runner.
		 * @private
		 * @param {Array} issues - An array of issues to process.
		 * @returns {Array} Returns an array of processed issues.
		 */
		function processIssues(issues) {
			if (options.rootElement) {
				issues = issues.filter(issue => isElementInTestArea(issue.element));
			}
			if (options.hideElements) {
				issues = issues.filter(issue => isElementOutsideHiddenArea(issue.element));
			}
			issues = issues.filter(issue => isHidden(issue.element));
			return issues.map(processIssue).filter(isIssueNotIgnored);
		}

		/**
		 * Check whether element is hidden or has hidden parent & should be ignored.
		 */
		 function hasHiddenParent(el) {
			if (el instanceof HTMLElement) {
	 			let p = el.parentNode;
	 			if (p instanceof HTMLElement) {
	 				if (
						(window.getComputedStyle(p, null).visibility == 'hidden') ||
						(p.style.visibility == 'hidden') ||
						(p.style.display == 'none') ||
						(window.getComputedStyle(p, null).display == 'none') ||
						(parseInt(p.style.textIndent, 10) < -100000) ||
						(parseInt(window.getComputedStyle(p, null).textIndent, 10) < -100000)
					) {
	 					return true;
	 				} else {
	 					return hasHiddenParent(p);
	 				}
	 			} else {
	 				return false;
	 			}
			} else {
				return false;
			}
 		}
		function isHidden(el) {
			if (el instanceof HTMLElement) {
				if (
					(window.getComputedStyle(el, null).visibility == 'hidden') ||
					(el.style.visibility == 'hidden') ||
					(el.style.display == 'none') ||
					(window.getComputedStyle(el, null).display == 'none') ||
					(parseInt(el.style.textIndent, 10) < -100000) ||
					(parseInt(window.getComputedStyle(el, null).textIndent, 10) < -100000)
				) {
					return false;
				}
			}
			if (hasHiddenParent(el)) {
				return false;
			}
			return true;
		}

		/**
		 * Process a runner issue.
		 * @private
		 * @param {Object} issue - An issue to process.
		 * @returns {Object} Returns the processed issue.
		 */
		function processIssue(issue) {
			return {
				code: issue.code,
				type: issue.type,
				typeCode: issueCodeMap[issue.type] || 0,
				message: issue.message,
				context: (issue.element ? getElementContext(issue.element) : ''),
				selector: (issue.element ? getElementSelector(issue.element) : ''),
				runner: issue.runner,
				runnerExtras: issue.runnerExtras || {}
			};
		}

		/**
		 * Check whether an issue should be returned, and is not ignored.
		 * @private
		 * @param {Object} issue - The issue to check.
		 * @returns {Boolean} Returns whether the issue should be returned.
		 */
		function isIssueNotIgnored(issue) {
			if (options.ignore.indexOf(issue.code.toLowerCase()) !== -1) {
				return false;
			}
			if (options.ignore.indexOf(issue.type) !== -1) {
				return false;
			}
			return true;
		}

		/**
		 * Check whether an element is in the test area specified by rootElement.
		 * @private
		 * @param {HTMLElement} element - The element to check.
		 * @returns {Boolean} Returns whether the element is in the test area.
		 */
		function isElementInTestArea(element) {
			const rootElement = window.document.querySelector(options.rootElement);
			return (rootElement ? rootElement.contains(element) : true);
		}

		/**
		 * Check whether an element is outside of all hidden selectors.
		 * @private
		 * @param {HTMLElement} element - The element to check.
		 * @returns {Boolean} Returns whether the element is outside of a hidden area.
		 */
		function isElementOutsideHiddenArea(element) {
			const hiddenElements = [...window.document.querySelectorAll(options.hideElements)];
			return !hiddenElements.some(hiddenElement => {
				return hiddenElement.contains(element);
			});
		}

	}

	/**
	 * Wait for a number of milliseconds.
	 * @private
	 * @param {Number} milliseconds - The number of milliseconds to wait for.
	 * @returns {Promise} Returns a promise which resolves in a number of milliseconds.
	 */
	function wait(milliseconds) {
		return new Promise(resolve => {
			setTimeout(resolve, milliseconds);
		});
	}

	/**
	 * Get a short version of an element's outer HTML.
	 * @private
	 * @param {HTMLElement} element - An element to get short HTML for.
	 * @returns {String} Returns the short HTML as a string.
	 */
	function getElementContext(element) {
		let outerHTML = null;
		let innerHTML = null;
		if (!element.outerHTML) {
			return outerHTML;
		}
		outerHTML = element.outerHTML;
		if (element.innerHTML.length > 31) {
			innerHTML = `${element.innerHTML.substr(0, 31)}...`;
			outerHTML = outerHTML.replace(element.innerHTML, innerHTML);
		}
		if (outerHTML.length > 251) {
			outerHTML = `${outerHTML.substr(0, 250)}...`;
		}
		return outerHTML;
	}

	/**
	 * Get a CSS selector for an element.
	 * @private
	 * @param {HTMLElement} element - An element to get a selector for.
	 * @param {Array} [selectorParts=[]] - Internal parameter used for recursion.
	 * @returns {String} Returns the CSS selector as a string.
	 */
	function getElementSelector(element, selectorParts = []) {
		if (isElementNode(element)) {
			const identifier = buildElementIdentifier(element);
			selectorParts.unshift(identifier);
			if (!element.id && element.parentNode) {
				return getElementSelector(element.parentNode, selectorParts);
			}
		}
		return selectorParts.join(' > ');
	}

	/**
	 * Build a unique CSS element identifier.
	 * @private
	 * @param {HTMLElement} element - An element to get a CSS element identifier for.
	 * @returns {String} Returns the CSS element identifier as a string.
	 */
	function buildElementIdentifier(element) {
		if (element.id) {
			return `#${element.id}`;
		}
		let identifier = element.tagName.toLowerCase();
		if (!element.parentNode) {
			return identifier;
		}
		const siblings = getSiblings(element);
		const childIndex = siblings.indexOf(element);
		if (!isOnlySiblingOfType(element, siblings) && childIndex !== -1) {
			identifier += `:nth-child(${childIndex + 1})`;
		}
		return identifier;
	}

	/**
	 * Get element siblings.
	 * @private
	 * @param {HTMLElement} element - An element to get siblings for.
	 * @return {Array} Returns an array of siblings as HTMLElements.
	 */
	function getSiblings(element) {
		return [...element.parentNode.childNodes].filter(isElementNode);
	}

	/**
	 * Check whether an element is the only sibling of its type.
	 * @private
	 * @param {HTMLElement} element - An element to check siblings of.
	 * @param {Array} siblings - The siblings of the element.
	 * @returns {Boolean} Returns whether the element is the only sibling of its type.
	 */
	function isOnlySiblingOfType(element, siblings) {
		const siblingsOfType = siblings.filter(sibling => {
			return (sibling.tagName === element.tagName);
		});
		return (siblingsOfType.length <= 1);
	}

	/**
	 * Check whether an element is an element node.
	 * @private
	 * @param {Node} element - An element to check.
	 * @returns {Boolean} Returns whether the element is an element node.
	 */
	function isElementNode(element) {
		return (element.nodeType === window.Node.ELEMENT_NODE);
	}

})(this));
