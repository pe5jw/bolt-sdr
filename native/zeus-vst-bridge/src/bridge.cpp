// SPDX-License-Identifier: GPL-2.0-or-later
//
// Openhpsdr-Zeus — VST3 bridge skeleton.
//
// Iter 6 of the plugin-system rebuild lands the C ABI + the stub
// implementation below. Iter 7 wires Steinberg's MIT-licensed
// vst3sdk into zvst_load_vst3 / zvst_process. Until then, the stubs
// return sensible status codes so the .NET wrapper can be unit-tested
// end-to-end without a real VST.

#include "zvst.h"

#include <atomic>
#include <cstring>

namespace {
    std::atomic<int> g_init_count{0};

    // Trivial pass-through "plugin" — frames * channels float32s.
    // Iter 7 swaps this for a Steinberg::Vst::IComponent /
    // IAudioProcessor pair and routes through ProcessData.
    struct StubPlugin {
        int32_t channels;
        int32_t sample_rate;
        int32_t block_size;
    };
}

extern "C" {

int32_t zvst_init(int32_t abi) {
    if (abi != ZVST_ABI) return ZVST_ABI_MISMATCH;
    g_init_count.fetch_add(1);
    return ZVST_OK;
}

int32_t zvst_load_vst3(
    const char* path,
    int32_t channels,
    int32_t sample_rate,
    int32_t block_size,
    zvst_handle_t* out_handle)
{
    if (!path || !out_handle) return ZVST_INVALID_ARGUMENTS;
    if (channels < 1 || channels > 2) return ZVST_INVALID_ARGUMENTS;
    if (sample_rate < 44100 || sample_rate > 192000) return ZVST_INVALID_ARGUMENTS;
    if (block_size < 32 || block_size > 4096) return ZVST_INVALID_ARGUMENTS;

    // Iter 7: replace with Module::create(path) + factory class scan +
    // initialise / setActive / setProcessing. For now we accept any
    // existing path and synthesise a pass-through.
    // (No file-existence check here — the .NET wrapper does it before
    // calling, see VstHostAudioPlugin.InitializeAudioAsync.)

    auto* p = new StubPlugin{channels, sample_rate, block_size};
    *out_handle = static_cast<void*>(p);
    return ZVST_OK;
}

int32_t zvst_process(
    zvst_handle_t handle,
    const float* input,
    float* output,
    int32_t frames)
{
    if (!handle) return ZVST_INVALID_HANDLE;
    if (!input || !output) return ZVST_INVALID_ARGUMENTS;
    auto* p = static_cast<StubPlugin*>(handle);
    if (frames < 1 || frames > p->block_size) return ZVST_INVALID_ARGUMENTS;

    // Pass-through stub — iter 7 replaces with ProcessData -> IAudioProcessor.
    const size_t n = static_cast<size_t>(p->channels) * static_cast<size_t>(frames);
    if (input != output) std::memcpy(output, input, n * sizeof(float));
    return ZVST_OK;
}

int32_t zvst_set_param(
    zvst_handle_t handle,
    uint32_t /* param_id */,
    double /* normalized */)
{
    if (!handle) return ZVST_INVALID_HANDLE;
    // Iter 7: forward to IEditController::setParamNormalized.
    return ZVST_NOT_IMPLEMENTED;
}

int32_t zvst_unload(zvst_handle_t handle) {
    if (!handle) return ZVST_OK;
    auto* p = static_cast<StubPlugin*>(handle);
    delete p;
    return ZVST_OK;
}

int32_t zvst_shutdown(void) {
    if (g_init_count.load() > 0) g_init_count.fetch_sub(1);
    return ZVST_OK;
}

} // extern "C"
