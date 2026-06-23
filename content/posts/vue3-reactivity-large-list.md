---
title: "Vue3 性能治理：响应式边界、大列表与组件拆分"
date: 2026-06-23T12:00:00+08:00
draft: false
author: "张晗"
categories: ["Vue"]
tags: ["Vue3", "响应式", "性能优化", "虚拟列表", "Pinia"]
summary: "Vue3 的性能问题往往不是框架慢，而是响应式边界设计不清晰。本文从响应式成本、大列表和状态拆分三个角度展开。"
---

Vue3 的响应式系统很好用，也正因为好用，很多性能问题会被隐藏到项目后期才出现。页面刚开始只有几个字段时，一切都很顺；等到表格列变多、筛选条件变复杂、弹窗和图表都挂在同一页时，卡顿才会突然冒出来。

我处理 Vue3 性能问题时，最先看的不是组件数量，而是响应式边界。

## 一、响应式不是免费的

Vue3 基于 Proxy 做响应式追踪，它可以精确追踪依赖，但依赖收集、触发更新、组件重新渲染都需要成本。尤其是深层对象、大数组和高频更新场景，成本会被放大。

如果一个对象只是静态配置，不需要响应式，就不要放进 `reactive`。

```ts
const columns = [
  { key: 'name', title: '姓名' },
  { key: 'role', title: '角色' },
  { key: 'department', title: '部门' },
]
```

如果外部库实例、图表实例、编辑器实例不需要被深度追踪，可以使用 `shallowRef` 或 `markRaw`。

```ts
const chartRef = shallowRef<ECharts | null>(null)

onMounted(() => {
  chartRef.value = markRaw(initChart(container.value))
})
```

这类边界处理看起来细，但在复杂后台页面里很常见。把“不该响应式的东西”排除出去，本身就是性能优化。

## 二、大列表的核心是减少 DOM 和响应式数据

大列表卡顿通常有三种来源：

- DOM 节点太多
- 每一行组件太重
- 列表数据被深度响应式代理

虚拟滚动只能解决第一类问题。如果每一行里还有复杂计算、权限判断、格式化函数和图表，仍然会慢。

一个更完整的治理思路是：

1. 服务端分页或游标分页，避免一次返回过多数据。
2. 列表使用虚拟滚动，限制 DOM 数量。
3. 行组件尽量纯展示，复杂操作延迟到展开或弹窗中。
4. 静态列配置保持非响应式。
5. 大数组只在必要层级响应式，避免深度代理。

```ts
const rawRows = shallowRef<UserRow[]>([])

async function loadUsers(params: QueryParams) {
  const result = await userApi.search(params)
  rawRows.value = result.list.map(normalizeUser)
}
```

如果列表数据只需要整体替换，不需要追踪每一层字段，`shallowRef` 往往比深层 `reactive` 更合适。

## 三、computed 要保持轻量

`computed` 适合表达派生状态，但不适合承载重计算。尤其不要在 `computed` 里做大数组全量过滤、排序、分组，然后又被多个组件依赖。

```ts
const visibleRows = computed(() => {
  return rows.value.filter(row => row.name.includes(keyword.value))
})
```

小数据这样写没问题；大数据就需要考虑：

- 搜索下沉到服务端
- 输入防抖
- Web Worker
- 分页后再过滤
- 缓存上一次计算结果

性能优化不是否定 `computed`，而是让它只做适合它做的事。

## 四、组件拆分不是越细越好

Vue 组件拆分的目标应该是隔离更新，而不是追求目录漂亮。一个组件是否该拆，我会看两个问题：

1. 它的状态变化是否独立？
2. 它的更新是否会拖累无关区域？

比如一个复杂详情页里，基础信息、审批记录、操作日志、关联工单，可以拆成几个区域组件。这样审批记录刷新时，不会让整个详情页都重新计算。

```vue
<template>
  <DetailLayout>
    <BasicInfo :detail="detail" />
    <ApprovalTimeline :id="detail.id" />
    <OperationLogs :id="detail.id" />
    <RelatedTickets :id="detail.id" />
  </DetailLayout>
</template>
```

但一个简单按钮拆成三层组件，反而会增加维护成本。组件边界应该服务于状态边界。

## 五、Pinia 状态也需要边界

Pinia 很轻量，但全局 store 不是垃圾桶。页面级状态、临时筛选、弹窗开关不应该随便放进去。

我通常这样划分：

| 状态 | 放置位置 |
| --- | --- |
| 用户信息、权限、系统配置 | Pinia |
| 服务端列表数据 | Vue Query 或页面 hook |
| 表单草稿 | 表单组件内部 |
| URL 可恢复筛选 | route query |
| 弹窗开关 | 页面局部状态 |

状态放错位置，会导致更新范围变大，也会让页面之间产生隐式耦合。

## 六、排查 Vue 性能问题的路径

比较稳定的排查顺序：

1. 先用 Chrome Performance 看主线程长任务。
2. 用 Vue Devtools 看组件更新频率。
3. 检查大数组、深层对象是否过度响应式。
4. 检查 `computed` 是否做了重计算。
5. 检查列表是否需要虚拟滚动。
6. 检查状态是否被放进了过大的 store。

这样排查会比盲目加缓存更可靠。

## 总结

Vue3 性能治理的关键词是“边界”：

- 响应式边界：不要追踪不需要追踪的数据。
- 组件边界：用拆分隔离更新，而不是制造目录层级。
- 状态边界：全局状态只放真正跨页面共享的内容。
- 渲染边界：大列表和复杂区域按需渲染。

Vue 的优势是开发效率高，但大型项目里，效率要靠边界继续维持。

## 参考资料

- [Vue Documentation: Performance](https://vuejs.org/guide/best-practices/performance.html)
- [Vue Documentation: Reactivity in Depth](https://vuejs.org/guide/extras/reactivity-in-depth.html)
- [Vue Documentation: Rendering Mechanism](https://vuejs.org/guide/extras/rendering-mechanism.html)
