---
layout:     post                    # 使用的布局（不需要改）
title:      一步步封装属于你的 Cocos Creator 事件管理工具               # 标题 
subtitle:   游戏开发如何使用我们前端的方式来管理操作事件 #副标题
date:       2022-11-12              # 时间
author:     Warden_Gfs                      # 作者
header-img: img/head-bg-view-22.png    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - 技术研讨
    - Cocos creator
    - 游戏开发
    - 事件管理
---

> 在我初次使用Cocos游戏开发时，首先遇到的问题是事件的通信，模块之间的解耦和事件通信是非常重要的设计理念。Cocos Creator 提供了内置的事件管理工具（cc.EventTarget），但其使用方式较为原始，无法很好地满足复杂场景中模块化和可维护性的需求。
为了提升代码的可读性、复用性和扩展性，我们结合前端组件化开发的思想，基于 cc.EventTarget 封装了一个事件管理工具 **YoloEvent**，并通过 **枚举规范化事件类型** 和 **单例模式**，实现了高效、灵活的事件管理。本文将详细介绍封装过程及其应用场景。


## 目标
**1** **事件统一管理**：通过封装，提供统一的事件触发、监听和取消监听的接口，减少模块间的耦合。
**2** **事件类型规范化**：使用枚举定义事件类型，避免事件名称冲突和拼写错误。
**3** **模块化设计**：使事件管理工具适用于不同模块（如全局事件、页面事件等），提升代码的复用性和可维护性。
**4** **简化代码逻辑**：为开发者提供更直观的事件操作 API。

⠀
## 事件管理工具设计与实现
### 1. 事件类型的规范化
在传统的事件管理中，事件名称往往是自由字符串，不利于统一管理。如果事件名称拼写错误，或者多个模块使用了相同的事件名称，可能会导致难以排查的 Bug。因此，我们使用 **枚举（Enum）** 定义事件类型，确保事件名称的唯一性和规范性。
**事件类型枚举**
通过枚举将事件分类管理，不同模块的事件类型使用独立的枚举命名空间，避免冲突。例如，以下是全局事件（GlobalEvent）、主页事件（HomeEvent）和加速弹框事件（AccelerateEvent）的定义：
```ts
// 全局事件
enum GlobalEvent {
  /**
   * 切换页面事件
   */
  CHANG_PAGE = 'CHANG_PAGE',
  /**
   * 去旅行的事件
   */
  GO_TRAVEL = 'GO_TRAVEL',
  /**
   * 旅行结束
   */
  BACK_HOME = 'BACK_HOME',
  /**
   * 展示或隐藏底部 Bar
   */
  SHOW_OR_HIDE_BOTTOM_BAR = 'SHOW_OR_HIDE_BOTTOM_BAR',
}

// 主页事件
enum HomeEvent {
  /**
   * 更新金币事件
   */
  UPDATE_TOKEN = 'UPDATE_TOKEN',
}

// 加速弹框事件
enum AccelerateEvent {
  /**
   * 更新加速时间事件
   */
  UPDATE_ACCELERATE_TIME = 'UPDATE_ACCELERATE_TIME',
  /**
   * 加速剩余时间
   */
  LEFT_ACCELERATE_TIME = 'LEFT_ACCELERATE_TIME',
  /**
   * 飞船加速
   */
  ADD_SHIP_SPEED = 'ADD_SHIP_SPEED',
}

// 旅行事件
enum TravelEvent {
  TravelEventFinish = 'TRAVEL_EVENT_FINISH',
}

// 统一导出事件类型
export const YoloEventType = {
  GlobalEvent: GlobalEvent,
  HomeEvent: HomeEvent,
  AccelerateEvent: AccelerateEvent,
  TravelEvent: TravelEvent,
};

// 类型定义，用于约束事件类型
export type TYoloEventType =
  | GlobalEvent
  | HomeEvent
  | AccelerateEvent
  | TravelEvent;
```
通过这种方式，开发人员可以清晰地了解每个模块有哪些事件，以及事件的作用。

### 2. 封装 YoloEvent 工具
基于 Cocos Creator 的 cc.EventTarget 封装事件管理工具 **YoloEvent**，使其支持单例模式，以便在全局范围内共享事件管理器。
**YoloEvent 实现代码**
以下是 YoloEvent 的完整实现：
```ts
import { EventTarget } from 'cc';
import { TYoloEventType } from './YoloEventType';

class YoloEvent {
  private static Instance: YoloEvent; // 单例实例
  private eventTarget: EventTarget; // 内部事件管理器

  constructor() {
    if (!YoloEvent.Instance) {
      YoloEvent.Instance = this;
      this.eventTarget = new EventTarget();
    }
    return YoloEvent.Instance;
  }

  // 注册事件监听
  on<TFunction extends (...args: any[]) => void>(
    type: TYoloEventType,
    callback: TFunction,
    thisArg?: any
  ): void {
    this.eventTarget.on(type, callback, thisArg);
  }

  // 注册单次触发的事件监听
  once<TFunction extends (...args: any[]) => void>(
    type: TYoloEventType,
    callback: TFunction,
    thisArg?: any
  ): void {
    this.eventTarget.once(type, callback, thisArg);
  }

  // 取消事件监听
  off<TFunction extends (...args: any[]) => void>(
    type: TYoloEventType,
    callback?: TFunction,
    thisArg?: any
  ): void {
    this.eventTarget.off(type, callback, thisArg);
  }

  // 检查是否有事件监听
  hasEventListener<TFunction extends (...args: any[]) => void>(
    type: TYoloEventType,
    callback?: TFunction,
    thisArg?: any
  ): boolean {
    return this.eventTarget.hasEventListener(type, callback, thisArg);
  }

  // 触发事件
  emit(type: TYoloEventType, ...args: any[]): void {
    this.eventTarget.emit(type, ...args);
  }
}

export default new YoloEvent();
```
**设计亮点
1** **单例模式**：通过 YoloEvent.Instance 确保全局只有一个事件管理器，避免实例冲突。
**2** **事件封装**：对常用的事件操作（如 on、once、off、emit）进行封装，简化调用逻辑。
**3** **类型安全**：通过 TYoloEventType 类型约束，确保只监听和触发合法的事件类型。

⠀
### 3. 应用场景
**场景 1：全局事件管理**
在游戏中，全局事件（如页面切换、UI 显示/隐藏）可以通过 YoloEvent 实现模块间的解耦。
```ts
import YoloEvent from './YoloEvent';
import { GlobalEvent } from './YoloEventType';

// 监听页面切换事件
YoloEvent.on(GlobalEvent.CHANG_PAGE, (pageName) => {
  console.log(`切换到页面: ${pageName}`);
});

// 触发页面切换事件
YoloEvent.emit(GlobalEvent.CHANG_PAGE, 'HomePage');
```
**场景 2：模块化事件通信**
例如，在加速弹框中监听和触发加速事件：
```ts
import YoloEvent from './YoloEvent';
import { AccelerateEvent } from './YoloEventType';

// 监听加速时间更新事件
YoloEvent.on(AccelerateEvent.UPDATE_ACCELERATE_TIME, (time) => {
  console.log(`加速时间更新为: ${time}`);
});

// 触发加速时间更新事件
YoloEvent.emit(AccelerateEvent.UPDATE_ACCELERATE_TIME, 120);
```
**场景 3：一次性事件监听**
在某些场景中（如旅行结束事件），只需要监听一次事件，可以使用 once 方法：
```ts
import YoloEvent from './YoloEvent';
import { TravelEvent } from './YoloEventType';

// 监听旅行结束事件（仅一次）
YoloEvent.once(TravelEvent.TravelEventFinish, () => {
  console.log('旅行结束，返回主页');
});

// 触发旅行结束事件
YoloEvent.emit(TravelEvent.TravelEventFinish);
```

### 4. 技术优势
**1** **模块解耦**：通过事件管理实现模块间的松耦合，避免直接依赖。
**2** **代码简洁**：封装了复杂的事件管理逻辑，简化开发者的使用成本。
**3** **易于维护**：通过事件类型枚举和单例模式，代码逻辑更加清晰且易于扩展。

⠀
### 5. 总结与展望
通过在 Cocos Creator 中引入前端组件化开发思想，我们基于 cc.EventTarget 封装了一个类似前端开发中的事件管理工具 **YoloEvent**，极大地提升了模块间通信的灵活性和可维护性。未来还可以进一步扩展该工具，例如支持事件优先级、异步处理等功能，更好地满足复杂游戏场景的需求。
希望这篇文章能为你的 Cocos 开发提供一些启发！
