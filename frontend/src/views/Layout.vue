<template>
  <el-container class="layout-container">
    <el-header class="layout-header">
      <div class="header-content">
        <div class="logo">
          <el-icon><Lock /></el-icon>
          <span>堡垒机授权检查系统</span>
        </div>
        <el-menu
          :default-active="activeMenu"
          mode="horizontal"
          router
          class="header-menu"
        >
          <el-menu-item index="/rules">
            <el-icon><Setting /></el-icon>
            <span>规则管理</span>
          </el-menu-item>
          <el-menu-item index="/records">
            <el-icon><Document /></el-icon>
            <span>授权记录</span>
          </el-menu-item>
          <el-menu-item index="/check">
            <el-icon><Search /></el-icon>
            <span>检查功能</span>
          </el-menu-item>
        </el-menu>
      </div>
    </el-header>
    <el-main class="layout-main">
      <router-view />
    </el-main>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Lock, Setting, Document, Search } from '@element-plus/icons-vue'

const route = useRoute()

const activeMenu = computed(() => {
  return route.path
})
</script>

<style lang="stylus" scoped>
.layout-container
  height 100vh
  background #f5f7fa

.layout-header
  height 60px !important
  background #fff
  box-shadow 0 2px 8px rgba(0, 0, 0, 0.1)
  padding 0
  z-index 1000

  .header-content
    display flex
    align-items center
    height 100%
    padding 0 24px
    max-width 1920px
    margin 0 auto

    .logo
      display flex
      align-items center
      gap 8px
      font-size 20px
      font-weight 600
      color #409eff
      margin-right 40px

      .el-icon
        font-size 24px

    .header-menu
      flex 1
      border-bottom none

      :deep(.el-menu-item)
        height 60px
        line-height 60px
        border-bottom 2px solid transparent

        &.is-active
          border-bottom-color #409eff
          color #409eff

.layout-main
  padding 24px
  overflow auto
</style>

