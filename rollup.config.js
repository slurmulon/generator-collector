import { babel, getBabelOutputPlugin } from '@rollup/plugin-babel'
// import buble from '@rollup/plugin-buble'
import json from '@rollup/plugin-json'
import terser from '@rollup/plugin-terser'
// import commonjs from '@rollup/plugin-commonjs'

export default {
  input: 'src/index.mjs',
  // output: {
  //   dir: 'output',
  //   // format: 'es'
  //   // format: 'iife'
  //   format: 'cjs'
  // },
  external: [/@babel\/runtime/],
  output: [
    {
      file: 'dist/index.cjs.js',
      format: 'cjs',
      // external: [/@babel\/runtime/],
      plugins: [
        getBabelOutputPlugin({
          // presets: ['@babel/preset-env'],//, '@babel/plugin-transform-spread']
          presets: ['@babel/preset-env'], //, '@babel/plugin-transform-runtime'],
          // WORKS! But not ideal for AJ since its so old
          // plugins: [['@babel/plugin-transform-runtime']],
        })
      ]
    },
    {
      file: 'dist/index.es.js',
      // external: [/@babel\/runtime/],
      format: 'es',
      // plugins: [
      //   getBabelOutputPlugin({
      //     presets: ['@babel/preset-env'],//, '@babel/plugin-transform-spread']
      //   })
      // ]
    }
  ],
  plugins: [
    // commonjs(),
    json(),
    babel({ babelHelpers: 'bundled' }),
    terser(),
    // WORKS! But not ideal for AJ since its so old
    // babel({ babelHelpers: 'runtime', plugins: [['@babel/plugin-transform-runtime']] }),
    // buble(),
  ]
  // plugins: [
  //   getBabelOutputPlugin({
  //     presets: ['@babel/preset-env'],//, '@babel/plugin-transform-spread']
  //   })
  // ]
}
