<template>
  <div
    v-if="visible"
    class="update-progress-indicator"
    @click="handleClick"
    :title="tooltip"
  >
    <el-icon class="indicator-icon" :class="{ downloading: isDownloading }">
      <Download v-if="!isDownloading" />
      <Loading v-else />
    </el-icon>
    <div v-if="showProgress" class="progress-ring">
      <svg class="progress-svg" viewBox="0 0 36 36">
        <circle
          class="progress-ring-bg"
          cx="18"
          cy="18"
          r="16"
          fill="none"
          stroke="#e4e7ed"
          stroke-width="2"
        />
        <circle
          class="progress-ring-fg"
          cx="18"
          cy="18"
          r="16"
          fill="none"
          stroke="#409eff"
          stroke-width="2"
          :stroke-dasharray="`${progress * 100.53 / 100} 100.53`"
          stroke-dashoffset="25.13"
        />
      </svg>
      <span class="progress-text">{{ progress }}%</span>
    </div>
    <div v-if="showBadge && hasUpdate" class="update-badge"></div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Download, Loading } from '@element-plus/icons-vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  progress: {
    type: Number,
    default: 0
  },
  isDownloading: {
    type: Boolean,
    default: false
  },
  hasUpdate: {
    type: Boolean,
    default: false
  },
  showProgress: {
    type: Boolean,
    default: true
  },
  showBadge: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['click'])

const tooltip = computed(() => {
  if (props.isDownloading) {
    return `正在下载更新 ${props.progress}%`
  }
  if (props.hasUpdate) {
    return '更新已下载完成，点击查看'
  }
  return '检查更新中...'
})

const handleClick = () => {
  emit('click')
}
</script>

<style lang="stylus" scoped>
.update-progress-indicator
  position fixed
  bottom 20px
  right 20px
  width 48px
  height 48px
  background #fff
  border-radius 50%
  box-shadow 0 2px 12px rgba(0, 0, 0, 0.15)
  cursor pointer
  display flex
  align-items center
  justify-content center
  z-index 9999
  transition all 0.3s ease

  &:hover
    transform scale(1.1)
    box-shadow 0 4px 16px rgba(0, 0, 0, 0.2)

  .indicator-icon
    font-size 24px
    color #409eff
    transition transform 0.3s ease

    &.downloading
      animation rotate 2s linear infinite

  .progress-ring
    position absolute
    width 100%
    height 100%
    top 0
    left 0

    .progress-svg
      width 100%
      height 100%
      transform rotate(-90deg)

    .progress-ring-bg
      opacity 0.3

    .progress-ring-fg
      transition stroke-dasharray 0.3s ease

    .progress-text
      position absolute
      top 50%
      left 50%
      transform translate(-50%, -50%)
      font-size 10px
      font-weight bold
      color #409eff

  .update-badge
    position absolute
    top -2px
    right -2px
    width 12px
    height 12px
    background #f56c6c
    border-radius 50%
    border 2px solid #fff
    animation pulse 2s infinite

@keyframes rotate
  from
    transform rotate(0deg)
  to
    transform rotate(360deg)

@keyframes pulse
  0%, 100%
    opacity 1
  50%
    opacity 0.5
</style>

