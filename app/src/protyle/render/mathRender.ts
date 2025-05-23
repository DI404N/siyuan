import {addScript} from "../util/addScript";
import {addStyle} from "../util/addStyle";
import {Constants} from "../../constants";
import {hasNextSibling, hasPreviousSibling} from "../wysiwyg/getBlock";
import {hasClosestBlock} from "../util/hasClosest";
import {looseJsonParse} from "../../util/functions";
import {genRenderFrame} from "./util";

export const mathRender = (element: Element, cdn = Constants.PROTYLE_CDN, maxWidth = false) => {
    let mathElements: Element[] = [];
    if (element.getAttribute("data-subtype") === "math") {
        // 编辑器内代码块编辑渲染
        mathElements = [element];
    } else {
        mathElements = Array.from(element.querySelectorAll('[data-subtype="math"]'));
    }
    if (mathElements.length === 0) {
        return;
    }
    addStyle(`${cdn}/js/katex/katex.min.css?v=0.16.9`, "protyleKatexStyle");
    addScript(`${cdn}/js/katex/katex.min.js?v=0.16.9`, "protyleKatexScript").then(() => {
        addScript(`${cdn}/js/katex/mhchem.min.js?v=0.16.9`, "protyleKatexMhchemScript").then(() => {
            mathElements.forEach((mathElement: HTMLElement) => {
                if (mathElement.getAttribute("data-render") === "true") {
                    return;
                }
                mathElement.setAttribute("data-render", "true");
                let macros = {};
                try {
                    macros = looseJsonParse(window.siyuan.config.editor.katexMacros || "{}");
                } catch (e) {
                    console.warn("KaTex macros is not JSON", e);
                }
                const isBlock = mathElement.tagName === "DIV";
                try {
                    const mathHTML = window.katex.renderToString(Lute.UnEscapeHTMLStr(mathElement.getAttribute("data-content")), {
                        displayMode: isBlock,
                        output: "html",
                        macros,
                        trust: true, // REF: https://katex.org/docs/supported#html
                        strict: (errorCode) => errorCode === "unicodeTextInMathMode" ? "ignore" : "warn",
                    });
                    const blockElement = hasClosestBlock(mathElement);
                    if (isBlock) {
                        genRenderFrame(mathElement);
                        mathElement.firstElementChild.firstElementChild.classList.remove("ft__error");
                        mathElement.firstElementChild.firstElementChild.setAttribute("contenteditable", "false");
                        mathElement.firstElementChild.firstElementChild.innerHTML = mathHTML;
                        // https://github.com/siyuan-note/siyuan/issues/3541
                        const baseElements = mathElement.querySelectorAll(".base");
                        if (baseElements.length > 0) {
                            baseElements[baseElements.length - 1].insertAdjacentHTML("afterend", "<span class='fn__flex-1'></span>");
                        }
                        // https://github.com/siyuan-note/siyuan/issues/4334
                        const newlineElement = mathElement.querySelector(".katex-html > .newline");
                        if (newlineElement) {
                            newlineElement.parentElement.style.display = "block";
                        }
                    } else {
                        mathElement.classList.remove("ft__error");
                        mathElement.innerHTML = mathHTML;
                        if (blockElement && mathElement.getBoundingClientRect().width > blockElement.clientWidth) {
                            mathElement.style.maxWidth = "100%";
                            mathElement.style.overflowX = "auto";
                            mathElement.style.overflowY = "hidden";
                            mathElement.style.display = "inline-block";
                        } else {
                            mathElement.style.maxWidth = "";
                            mathElement.style.overflowX = "";
                            mathElement.style.overflowY = "";
                            mathElement.style.display = "";
                        }
                        const nextSibling = hasNextSibling(mathElement) as HTMLElement;
                        if (!nextSibling) {
                            // 表格编辑问题 https://ld246.com/article/1629191424824
                            if (mathElement.parentElement.tagName !== "TH" && mathElement.parentElement.tagName !== "TD") {
                                // 光标无法移动到末尾 https://github.com/siyuan-note/siyuan/issues/2112
                                mathElement.insertAdjacentText("afterend", "\n");
                            } else {
                                // https://ld246.com/article/1651595975481，https://ld246.com/article/1658903123429
                                // 随着浏览器的升级，从 beforeend 修改为 afterend
                                mathElement.insertAdjacentText("afterend", Constants.ZWSP);
                            }
                        } else if (nextSibling && nextSibling.nodeType !== 3 &&
                            (
                                nextSibling.getAttribute("data-type")?.indexOf("inline-math") > -1 ||
                                nextSibling.classList.contains("img")
                            )) {
                            // 相邻的数学公式删除或光标移动有问题
                            mathElement.after(document.createTextNode(Constants.ZWSP));
                        } else if (nextSibling &&
                            !nextSibling.textContent.startsWith("\n") && // https://github.com/siyuan-note/insider/issues/1089
                            // 输入 $a$ 后，光标移动到其他块，再点击 a 后，光标不显示 https://github.com/siyuan-note/insider/issues/1076#issuecomment-1253215515
                            nextSibling.textContent !== Constants.ZWSP) {
                            // 数学公式后一个字符删除多 br https://ld246.com/article/1647157880974
                            // 数学公式后有 \n 不能再添加 &#xFEFF; https://ld246.com/article/1647329437541
                            mathElement.insertAdjacentHTML("beforeend", "&#xFEFF;");
                        }
                        // 光标无法移动到段首 https://ld246.com/article/1623551823742
                        if (mathElement.previousSibling?.textContent.endsWith("\n")) {
                            mathElement.insertAdjacentText("beforebegin", Constants.ZWSP);
                        } else if (!hasPreviousSibling(mathElement) && ["TH", "TD"].includes(mathElement.parentElement.tagName)) {
                            // 单元格中只有数学公式时，光标无法移动到数学公式前
                            mathElement.insertAdjacentText("afterbegin", Constants.ZWSP);
                        }
                    }

                    // export pdf
                    if (maxWidth) {
                        setTimeout(() => {
                            if (isBlock) {
                                const katexElement = mathElement.querySelector(".katex-display");
                                if (katexElement.clientWidth < katexElement.scrollWidth) {
                                    katexElement.firstElementChild.setAttribute("style", `font-size:${katexElement.clientWidth * 100 / katexElement.scrollWidth}%`);
                                }
                            } else {
                                if (blockElement && mathElement.offsetWidth > blockElement.clientWidth) {
                                    mathElement.firstElementChild.setAttribute("style", `font-size:${blockElement.clientWidth * 100 / mathElement.offsetWidth}%`);
                                }
                            }
                        });
                    }
                } catch (e) {
                    if (isBlock) {
                        genRenderFrame(mathElement);
                        mathElement.firstElementChild.firstElementChild.setAttribute("contenteditable", "false");
                        mathElement.firstElementChild.firstElementChild.innerHTML = e.message;
                        mathElement.firstElementChild.firstElementChild.classList.add("ft__error");
                    } else {
                        mathElement.innerHTML = e.message;
                        mathElement.classList.add("ft__error");
                    }
                }
            });
        });
    });
};
