# SPDX-License-Identifier: GPL-2.0-or-later
#
# Openhpsdr-Zeus VST3 bridge — minimal CMake build.
#
# Iter 6 (current): builds the stub library so .NET tests can P/Invoke
# without a real vst3sdk dependency. Iter 7 adds vst3sdk + CLAP SDK as
# vendored submodules and replaces the stub.
#
#   cmake -B build -DCMAKE_BUILD_TYPE=Release
#   cmake --build build
#
# Output: build/libzeus-vst-bridge.{so,dylib,dll}

cmake_minimum_required(VERSION 3.20)
project(zeus-vst-bridge VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

add_library(zeus-vst-bridge SHARED
    src/bridge.cpp
)

target_include_directories(zeus-vst-bridge
    PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include
)

# Iter 7 hook: subdir for vendored vst3sdk + CLAP. Left as a comment
# until that lands so iter 6 builds clean without the submodules.
# add_subdirectory(third_party/vst3sdk EXCLUDE_FROM_ALL)
# target_link_libraries(zeus-vst-bridge PRIVATE sdk_hosting)

# Strip exported symbols to just the zvst_* C ABI on platforms that
# support it. Windows uses __declspec(dllexport) instead — left for
# iter 7 alongside the .def file.
if(NOT WIN32)
    set_target_properties(zeus-vst-bridge PROPERTIES
        CXX_VISIBILITY_PRESET hidden
        VISIBILITY_INLINES_HIDDEN ON)
endif()

# Make 'install' put the lib next to the Zeus binary at build time
# so .NET runtime resolution finds it. Operators using their own
# packaging override CMAKE_INSTALL_PREFIX.
install(TARGETS zeus-vst-bridge
    LIBRARY DESTINATION lib
    RUNTIME DESTINATION bin
    ARCHIVE DESTINATION lib)
install(FILES include/zvst.h DESTINATION include)
