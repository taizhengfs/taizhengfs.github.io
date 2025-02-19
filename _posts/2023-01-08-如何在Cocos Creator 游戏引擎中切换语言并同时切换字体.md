---
layout:     post                    # 使用的布局（不需要改）
title:      如何在Cocos Creator 游戏引擎中切换语言并同时切换字体               # 标题 
subtitle:   游戏项目中语言和字体同时切换的办法 #副标题
date:       2023-01-08              # 时间
author:     Warden_Gfs                      # 作者
header-img: img/head-bg-view-16.png    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - 技术研讨
    - Cocos creator
    - 游戏开发
    - 国际化
---

> 在游戏开发中，多语言支持不仅仅是对不同地区玩家的友好，更是游戏全球化的重要一步。而在语言切换的过程中，如何优雅地实现文本和字体的同步切换，是一项兼具技术性与艺术性的挑战。特别是在 Cocos Creator 这样的游戏引擎中，既要保证高性能和流畅的用户体验，又要兼顾内存占用和实现的灵活性，这对开发者提出了更高的要求。

本文从实际项目需求出发，结合多语言文本资源管理、动态字体切换和组件模块化设计，提供了一种高效的解决方案。希望通过这篇文章，能为致力于提升游戏用户体验的开发者们提供一些有益的启发与参考。


### 一种在 Cocos Creator 游戏引擎中实现语言与字体同步切换的解决方案

---

## 前言

在全球化游戏开发中，多语言支持是至关重要的设计环节。这不仅仅是对不同地区玩家的适配，更是提升用户体验和游戏市场覆盖率的重要手段。在 Cocos Creator 游戏引擎中，虽然内置了一些多语言支持的基础工具，但要实现文本语言与字体资源的动态同步切换，仍然需要开发者进行深度定制。

本文从实际项目需求出发，针对多语言文本切换和对应字体更换的技术难点，设计并实现了一套高效的解决方案。通过合理的资源管理、模块化脚本封装和灵活的动态加载机制，本文方案在保证性能的前提下为多语言支持提供了更优雅的实现。以下将结合具体代码实现和思路解析，带大家深入了解这一方案的设计与实现。

---

## 1. 准备多语言文本与字体资源

### 1.1 准备多语言文本

首先，需要为游戏准备多语言的文本资源。假设需要支持英语（English）、简体中文（Simplified Chinese）和繁体中文（Traditional Chinese），可以在项目中创建一个 `i18n` 文件夹，用于存放不同语言的 JSON 文件。每个文件对应一个语言版本，文件内容格式大致如下：

**`i18n/en.json` (英文)**

```json
{
  "setting": {
    "music": "Music",
    "sound": "Sound"
  },
  "event": {
    "box": {
      "progress": "Progress: {progress}"
    }
  }
}
```

**`i18n/zh.json` (简体中文)**

```json
{
  "setting": {
    "music": "音乐",
    "sound": "音效"
  },
  "event": {
    "box": {
      "progress": "进度：{progress}"
    }
  }
}
```

**`i18n/tw.json` (繁体中文)**

```json
{
  "setting": {
    "music": "音樂",
    "sound": "音效"
  },
  "event": {
    "box": {
      "progress": "進度：{progress}"
    }
  }
}
```
项目中示例图片：
![1](/img/20230108/1.png)

### 1.2 准备字体资源

在文本切换的同时，针对不同语言使用不同字体资源是提升游戏表现力的重要手段。将所需字体资源导入 Cocos Creator 项目中，并按照路径存储，例如：

```plaintext
gui/common/fnt/ConcertOne-Regular   // 英文字体
gui/common/fnt/Fangzheng-normal     // 简体中文字体
gui/common/fnt/Fangzheng-tw         // 繁体中文字体
```

确保这些字体资源能够覆盖目标语言的字符集，以保证在运行时不会出现字体缺失或乱码问题。

---

## 2. 创建语言管理器脚本

语言管理器的核心职责是负责管理多语言切换和字体同步切换的逻辑。创建一个名为 `LanguageManager.ts` 的脚本，负责以下功能：

1. **加载不同语言的字体文件**：根据当前语言动态加载对应的字体资源。
2. **存储当前语言和字体信息**：在脚本中维护当前语言和字体的状态。
3. **提供切换语言和字体的统一接口**：便于其他模块调用。

以下是代码实现的核心部分：

```ts
import { _decorator, Component, Font, Label, instantiate, find } from 'cc';
import LocalData from './LocalData';

const { ccclass, property } = _decorator;

@ccclass('LanguageManager')
export class LanguageManager extends Component {
  @property(Font)
  englishFont: Font = null;

  @property(Font)
  chineseFont: Font = null;

  @property(Font)
  traditionalChineseFont: Font = null;

  onLoad() {
    // 重写 instantiate 方法，在实例化预制体时根据当前语言动态加载字体
    window.instantiate = window.instantiate || this.instantiateWithFont.bind(this);
    window.changeFont = window.changeFont || this.changeFont.bind(this);
  }

  // 根据语言 ID 获取对应字体
  getNewFont(languageId: number): Font {
    const fontMap = {
      1: this.englishFont,
      2: this.chineseFont,
      3: this.traditionalChineseFont,
    };
    return fontMap[languageId] || this.englishFont; // 默认返回英文
  }

  // 应用当前语言的字体到指定 Label
  applyCurrentFont(label: Label) {
    label.font = this.getNewFont(LocalData.getYoloLanguage());
  }

  // 切换语言时更新所有 Label 的字体
  changeFont(languageId: number) {
    const labels = find('gui').getComponentsInChildren(Label);
    labels.forEach((label) => {
      label.font = this.getNewFont(languageId);
    });
  }

  // 实例化预制体时动态设置字体
  instantiateWithFont(prefab) {
    const instance = instantiate(prefab);
    const labels = instance.getComponentsInChildren(Label);
    labels.forEach((label) => {
      this.applyCurrentFont(label);
    });
    return instance;
  }
}
```

---

## 3. 创建本地化文本组件脚本

为了更方便地管理场景中的多语言文本节点，我们可以创建一个本地化文本组件脚本 `LocalizedLabel.ts`。该组件会根据当前语言自动更新文本内容，同时支持动态参数替换。

**代码实现：**

```ts
import * as i18n from './LanguageData';
import { _decorator, Component, Label } from 'cc';
import LocalData from './LocalData'; // 本地数据管理模块

const { ccclass, property, executeInEditMode } = _decorator;

@ccclass('LocalizedLabel')
@executeInEditMode
export class LocalizedLabel extends Component {
  label: Label | null = null;

  @property({ visible: false })
  key: string = '';

  @property({ displayName: 'Key', visible: true })
  get _key() {
    return this.key;
  }

  set _key(str: string) {
    this.key = str;
    this.updateLabel();
  }

  onLoad() {
    if (!i18n.ready) {
      i18n.init(LocalData.getYoloLanguage());
      window.changeFont(LocalData.getYoloLanguage());
    }
    this.fetchRender();
  }

  setKey(key: string, params?: Record<string, string>) {
    this.key = key;
    this.fetchRender(params);
  }

  fetchRender(params?) {
    const label = this.getComponent(Label);
    if (label) {
      this.label = label;
      this.updateLabel(params);
    }
  }

  updateLabel(params?) {
    if (this.label) {
      this.label.string = i18n.t(this.key, params);
    }
  }
}
```

---

## 4. 为场景文本节点添加本地化组件

在场景中，找到需要支持多语言的文本节点，将 `LocalizedLabel.ts` 脚本挂载到节点上，然后在 `key` 属性中输入对应的 JSON 键值（例如 `setting.music` 或 `event.box.progress`）。这样，语言切换时，文本内容和字体会自动更新。
![3](/img/20230108/3.png)

---

## 5. 编写语言切换逻辑

在设置界面中，可以通过按钮点击事件触发语言切换。例如：

```ts
// 切换语言按钮回调
this.progressText.getComponent(LocalizedLabel).setKey('event.box.progress', { progress: `${curEventIndex}/${eventMax}` });
window.changeFont(newLanguageId); // 切换字体
```

---

## 小结

多语言支持是游戏开发中不可忽视的功能，特别是在全球化运营的背景下，优雅地实现语言和字体的同步切换尤为重要。本文通过模块化的设计和灵活的动态加载机制，为 Cocos Creator 游戏提供了一种高效的语言与字体切换解决方案。

在实际应用中，我们还可以进一步优化，如引入懒加载机制减少内存占用，或者通过事件监听机制实现更高效的语言切换。希望本文的内容能为您的游戏开发提供有价值的参考。
效果展示：
![4](/img/20230108/4.png)![5](/img/20230108/5.png)![6](/img/20230108/6.png)![7](/img/20230108/7.png)
